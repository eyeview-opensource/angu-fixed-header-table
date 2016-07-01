/**
 * This code was initially based on:
 *
 * AngularJS fixed header scrollable table directive
 * @author Jason Watmore <jason@pointblankdevelopment.com.au> (http://jasonwatmore.com)
 * @version 1.2.0 (https://github.com/cornflourblue/angu-fixed-header-table/commit/41f8dfd1f35a242f2931cbf1885c82cfaace671b)
 */
(function(){

    var Utils = (function(){

        function debounce(func, wait, immediate){
            var timeout;
            return function() {
                var context = this, args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        }

        function isInteger(strNum){
            return /^\+?\d+$/.test(strNum);
        }

        function getHeight(e){
            e.style.display = 'none';
            var p = angular.element(e.parentElement);
            var height = window.innerHeight - p.offset().top - p.height();
            var i = p[0];
            while (i && i != document.body) {
                try {
                    height -= parseFloat(
                        window
                            .getComputedStyle(i)
                            .paddingBottom
                            .replace(/^(-?(?:\d)?(?:.\d+)?)[A-Za-z%]*$/, '$1')
                    );
                } catch (x) {}
                i = i.parentElement;
            }
            e.style.display = '';
            return height;
        }

        //--- API
        return {
            debounce : debounce,
            isInteger : isInteger,
            getHeight : getHeight
        };
    })();

    //------------------------------------------------------------------------//
    // @begin: directive code

    function fixedHeader($timeout, $window){

        function postLink($scope, $elem, $attrs){
            var ATTR_CHECK_WIDTH = 'fixedHeaderCheckWidth';
            var checkMinWidthValue = 1300;

            var elem = $elem[0];
            var wrap, $scrollable, scrollable;

            var checkWindowWidthFlag = false;
            var defineColumnWidthFlag = false;
            var resizeTimeout;
            var viewHeight = 0;

            //---

            // Clone the header and footer again using the shadowed table as reference
            function recloneHeaderAndFooter(){
                if (!wrap || !elem) {
                    return;
                }

                var sourceTableElems = wrap.querySelectorAll('table.shadowed thead, table.shadowed tfoot');
                var destinationTableElems = elem.querySelectorAll('thead, tfoot');
                for (var i=0; i < sourceTableElems.length; i++) {
                    destinationTableElems[i].parentNode.replaceChild(
                        sourceTableElems[i].cloneNode(true),
                        destinationTableElems[i]
                    );
                }
            }

            function updateViewHeight(refresh){
                if (!wrap || !elem || !$elem.is(':visible')) {
                    return;
                }
                if (refresh) {
                    viewHeight = ($attrs.tableHeight === 'auto' || !$attrs.tableHeight) ?
                        Utils.getHeight(wrap) : $attrs.tableHeight;
                }
                var height = viewHeight;
                scrollable.style.height = Math.min(height, elem.offsetHeight) - (wrap.offsetHeight - wrap.clientHeight) + 'px';
                if (wrap.offsetWidth < scrollable.offsetWidth) {
                    scrollable.style.paddingRight = (scrollable.offsetWidth - scrollable.clientWidth) + 'px';
                } else {
                    scrollable.style.paddingRight = '0px';
                }
                wrap.style.height = Math.min(height, elem.offsetHeight) + 'px';
            }

            function transformTable(){
                recloneHeaderAndFooter();

                // wrap in $timeout to give table a chance to finish rendering
                $timeout(function(){
                    if(!$elem.is(':visible')){
                        return;
                    }

                    var shadows = wrap.querySelectorAll('table.shadowed');
                    angular.forEach(elem.querySelectorAll('thead, tfoot'), function (cont, index) {
                        var tableWidth = 0;
                        angular.forEach(cont.querySelectorAll('tr'), function(row, rowIndex) {
                            var rowWidth = 0;
                            angular.forEach(row.querySelectorAll('td,th'), function(cell, cellIndex) {
                                var el = shadows[index].querySelector(
                                    'tr:nth-child(' + (rowIndex+1) + ') ' +
                                    cell.nodeName + ':nth-child(' + (cellIndex+1)  + ')');
                                if (!el) {
                                    return;
                                }

                                if(defineColumnWidthFlag){
                                    el.style.width = cell.offsetWidth + 'px';
                                }

                                el.style.minWidth = '0px';
                                el.style.maxWidth = '100%';
                                rowWidth += cell.offsetWidth;
                            });
                            tableWidth = Math.max(tableWidth, rowWidth);
                        });
                        if (tableWidth > 0) {
                            shadows[index].style.width = (tableWidth+1) + 'px';
                        }
                    }, 50);

                    $scrollable.css({
                        display: 'block',
                        minWidth: '100%',
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        position: 'absolute'
                    });
                    updateViewHeight(true);
                });
            }

            // for performance reasons, ignore events caused by rapidly repeating events
            // like animations
            var delayTransformTable = Utils.debounce(transformTable, 50);

            //---

            function tableDataLoaded(){
                // first cell in the tbody exists when data is loaded but doesn't have a width
                // until after the table is transformed
                var firstCell = elem.querySelector('tbody tr:first-child td:first-child');
                return firstCell && !firstCell.style.width;
            }

            //---

            function checkWindowWidth(){
                if(checkWindowWidthFlag){
                    defineColumnWidthFlag = (
                        window.innerWidth <= checkMinWidthValue
                    ); // px
                } else {
                    defineColumnWidthFlag = true;
                }
            }

            function resizeHandler(){
                checkWindowWidth();

                if(resizeTimeout){
                    $timeout.cancel(resizeTimeout);
                    resizeTimeout = null;
                }
                resizeTimeout = $timeout(function(){
                    resizeTimeout = null;
                    transformTable();
                }, 100);
            }

            //---

            function checkAttrs(){
                if(angular.isDefined($attrs[ATTR_CHECK_WIDTH])){
                    // if `fixed-header-check-width` is present
                    // this makes the code flow check the windows width on resize
                    checkWindowWidthFlag = true;

                    var value = $attrs[ATTR_CHECK_WIDTH];
                    if(Utils.isInteger(value)){
                        value = parseInt(value);
                        // use defined value if greater than 1000px, else use default value (1300px)
                        checkMinWidthValue = (value > 1000) ? value : checkMinWidthValue;
                    }
                    value = null;
                }
            }

            function rebuildDOMTree(){
                $timeout(function(){
                    wrap = document.createElement('div');
                    elem.parentNode.insertBefore(wrap, elem);
                    wrap.appendChild(elem);
                    wrap.style.position = 'relative';
                    wrap.style.xIndex = 1;
                    wrap.style.overflowX = 'auto';
                    wrap.style.overflowY = 'hidden';
                    elem.style.width = 'auto';
                    elem.style.minWidth = '100%';

                    scrollable = document.createElement('div');
                    wrap.appendChild(scrollable);
                    scrollable.appendChild(elem);
                    //scrollable.style.margin = window.getComputedStyle(elem).margin;
                    $scrollable = angular.element(scrollable);
                    elem.style.margin = '0px';

                    var clone = elem.querySelectorAll('thead, tfoot');
                    for (var i=0; i < clone.length; i++) {
                        var tShadow = document.createElement('table');
                        var cloned = clone[i].cloneNode(true);
                        wrap.appendChild(tShadow);
                        tShadow.className = (elem.className||'') + ' shadowed';
                        elem.replaceChild(cloned, clone[i]);
                        tShadow.appendChild(clone[i]);
                        angular.element(tShadow).css({
                            position: 'absolute',
                            top: cloned.nodeName === 'THEAD' ? 0 : 'auto',
                            bottom: cloned.nodeName === 'TBODY' ? 0 : 'auto',
                            tableLayout: 'fixed',
                            margin: 0,
                            padding: 0,
                            zIndex: 10,
                            width: 'auto'
                        });
                        cloned.style.visibility = 'hidden';
                    }
                });
            }

            //---

            (function initFlow(){
                checkAttrs();
                checkWindowWidth(); // this should be called after check attributes
                rebuildDOMTree();

                //---

                $($window).on('resize', resizeHandler);
                var updateTableListener = $scope.$on('fixedHeader:updateTable', delayTransformTable);
                var afterReloadDataListener = $scope.$on('ngTable:afterReloadData', delayTransformTable);

                // wait for data to load and then transform the table
                var tableDataLoadedWatch = $scope.$watch(tableDataLoaded, function(isTableDataLoaded) {
                    if (isTableDataLoaded) {
                        transformTable();
                    }
                });

                $scope.$on('$destroy', function(){
                    // remove listeners
                    $($window).off('resize', resizeHandler);
                    updateTableListener();
                    updateTableListener = null;
                    afterReloadDataListener();
                    afterReloadDataListener = null;
                    tableDataLoadedWatch();
                    tableDataLoadedWatch = null;

                    //---

                    // cleanup variables
                    ATTR_CHECK_WIDTH = null;
                    checkMinWidthValue = null;

                    elem = null;
                    wrap = null;
                    $scrollable = null;
                    scrollable = null;

                    checkWindowWidthFlag = null;
                    defineColumnWidthFlag = null;
                    resizeTimeout = null;
                    viewHeight = null;
                    delayTransformTable = null;
                });
            })();
        }

        // directive config
        return {
            restrict: 'A',
            link: postLink
        };
    }

    fixedHeader.$inject = ['$timeout', '$window'];

    // @end: directive code
    //------------------------------------------------------------------------//

    /**
     * @ngdoc directive
     * @name anguFixedHeaderTable.directive:fixed-header
     *
     * @restrict A
     *
     * @description
     * transform html table to have the header always visible,
     * horizontal and vertical scrolls enabled
     *
     *
     * Usage:
     *
     * <table fixed-header
     *   <!-- optional:
     *     fixed-header-check-width or fixed-header-check-width="1200"
     *       if present define the code flow to check window width and that
     *       will change the code flow to update the table header UI
     *   -->
     * >
     *   <!-- table content -->
     * </table>
     */
    angular
        .module('anguFixedHeaderTable', [])
        .directive('fixedHeader', fixedHeader);
})();
