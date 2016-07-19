/**
 * This code was initially based on:
 *
 * AngularJS fixed header scrollable table directive
 * @author Jason Watmore <jason@pointblankdevelopment.com.au> (http://jasonwatmore.com)
 * @version 1.2.0 (https://github.com/cornflourblue/angu-fixed-header-table/commit/41f8dfd1f35a242f2931cbf1885c82cfaace671b)
 */
(function(){

    var Utils = (function(){

        var REGEXP = {
            IS_INTEGER : /^\+?\d+$/,
            PADDING_BOTTOM_REPLACE : /^(-?(?:\d)?(?:.\d+)?)[A-Za-z%]*$/
        };

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
            return REGEXP.IS_INTEGER.test(strNum);
        }


        function isBoolean(value) {
            return typeof value === 'boolean';
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
                            .replace(REGEXP.PADDING_BOTTOM_REPLACE, '$1')
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
            isBoolean : isBoolean,
            getHeight : getHeight
        };
    })();

    //------------------------------------------------------------------------//
    // @begin: directive code

    function fixedHeader($timeout, $window, $q, $rootScope){
        var attr_prefix = 'fixedHeader';
        var ATTRS = {
            CHECK_WIDTH : attr_prefix + 'CheckWidth', // fixed-header-check-width
            SCROLL : {
                ON_TOP : attr_prefix + 'ScrollOnTop', // fixed-header-scroll-on-top
                ON_BOTTOM : attr_prefix + 'ScrollOnBottom', // fixed-header-scroll-on-bottom
                REDEFINE_POSITION : attr_prefix + 'ScrollRedefinePosition' // fixed-header-scroll-redefine-position
            },
            ROW_CLASSNAME : attr_prefix + 'RowClassname', // fixed-header-row-classname
            LOADING : attr_prefix + 'Loading' // fixed-header-loading
        };
        var SCROLL_POSITION = {
            TOP : 'top',
            BOTTOM : 'bottom'
        };
        var EVENTS = {
            FIXED_HEADER : {
                UPDATE_TABLE : 'fixedHeader:updateTable',
                LOADING : 'fixedHeader:loading',
                SCROLL_TO_TOP : 'fixedHeader:scrollToTop'
            },
            NG_TABLE : 'ngTable:afterReloadData'
        };

        function postLink($scope, $elem, $attrs){
            var checkMinWidthValue = 1300;
            var rowClassname = '';

            var elem = $elem[0];
            var wrap, $scrollable, scrollable;

            var checkWindowWidthFlag = false;
            var defineColumnWidthFlag = false;
            var resizeTimeout;
            var viewHeight = 0;
            var lastWindowHeight = 0;

            var shouldRedefineScrollPosition = false;
            var verticalScrollTimeout;
            var scrollOnTopAction = null;
            var scrollOnBottomAction = null;

            //---

            function triggerLoadingEvent(flag){ // TODO: review
                $rootScope.$broadcast(EVENTS.FIXED_HEADER.LOADING, flag);
            }

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
                var deferred = $q.defer();
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

                    deferred.resolve('done');
                });

                return deferred.promise;
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
                } else {
                    lastWindowHeight = window.innerHeight;
                }

                resizeTimeout = $timeout(function(){
                    resizeTimeout = null;
                    transformTable()
                        .then(function(){
                            if(lastWindowHeight !== window.innerHeight){
                                updateViewHeight(true);
                            }
                            lastWindowHeight = null;
                        });
                }, 100);
            }

            //---
            // @begin: scroll

            function disableVScrollListener(){
                triggerLoadingEvent(true);
                $scrollable.off('scroll', verticalScrollHandler);
            }

            function enableVScrollListener(){
                $timeout(function(){
                    triggerLoadingEvent(false);
                    $scrollable.on('scroll', verticalScrollHandler);
                },100);
            }

            function getElementsSelector(){
                return (
                    'table tbody tr' + (
                        rowClassname ? ('.' + rowClassname) : ''
                    )
                );
            }

            function getElementOn(position){
                var lines = elem.querySelectorAll(getElementsSelector());
                var el;

                switch(position){
                    case SCROLL_POSITION.TOP:
                        el = lines[0];
                        break;
                    case SCROLL_POSITION.BOTTOM:
                        el = lines[(lines.length-1)];
                        break;
                }

                lines = null;
                selector = null;

                return el.cloneNode(true);
            }

            function findElementOn(position, findEl){
                var lines = elem.querySelectorAll(getElementsSelector());
                var el = null;

                // transform NodeList into js array
                lines = Array.prototype.slice.call(lines);
                if(position === SCROLL_POSITION.BOTTOM){
                    lines.reverse();
                }
                lines = lines.filter(function(itemEl){
                    return (itemEl.innerHTML === findEl.innerHTML);
                });
                if(lines.length > 0){
                    el = lines[0];
                }
                lines = null;
                return el;
            }

            function scrollToPosition(newPosition){
                $scrollable.animate({scrollTop:newPosition}, 1500, 'swing');
            }

            function redefineScrollPosition(position, el){
                $timeout(function(){
                    el = findElementOn(position, el);
                    if(!el){
                        enableVScrollListener();
                        return;
                    }

                    el = angular.element(el);

                    // make sure the scroll content is relative, to get accurate offset
                    $scrollable.css({position : 'relative'});
                    var currentScroll = $scrollable.scrollTop();
                    var offset = el.position().top + currentScroll;
                    var height = $scrollable.height();
                    $scrollable.css({position : ''});

                    var newTopPosition = 0;

                    switch(position){
                        case SCROLL_POSITION.TOP:
                            var tableHeader = wrap.querySelectorAll('table.shadowed thead');
                            var tableHeaderHeight = angular.element(tableHeader).height();
                            var rowHeight = el.height();
                            if(offset > rowHeight){
                                newTopPosition = (
                                    offset - tableHeaderHeight
                                );
                            }
                            rowHeight = null;
                            tableHeaderHeight = null;
                            tableHeader = null;
                            break;
                        case SCROLL_POSITION.BOTTOM:
                            newTopPosition = ((offset + el.height()) - height);
                            break;
                    }

                    scrollToPosition(newTopPosition);
                    newTopPosition = null;

                    enableVScrollListener();
                    el = null;
                });
            }

            // TODO: remove
            function logScrollInfo(){
                console.log(
                    'scrollable > scrollTop : ', scrollable.scrollTop,
                    ' > scrollHeight : ', scrollable.scrollHeight,
                    ' > clientHeight : ', scrollable.clientHeight
                );
            }

            function doVerticalScrollCheck(){
                var el;
                var offset = 0;
                var delta = (
                    scrollable.scrollHeight - scrollable.scrollTop - scrollable.clientHeight
                );

                // value expected to return from the scroll action callback execution
                var redefineScrollPositionFlag = true;

                if((scrollable.scrollTop <= offset) && scrollOnTopAction){
                    disableVScrollListener();
                    if(shouldRedefineScrollPosition) {
                        el = getElementOn(SCROLL_POSITION.TOP);
                    }

                    $timeout(function(){

                        redefineScrollPositionFlag = $scope.$apply(scrollOnTopAction);
                        redefineScrollPositionFlag = (
                            Utils.isBoolean(redefineScrollPositionFlag) ? redefineScrollPositionFlag : false
                        );

                        if(shouldRedefineScrollPosition && redefineScrollPositionFlag) {
                            redefineScrollPosition(SCROLL_POSITION.TOP, el);
                        } else {
                            enableVScrollListener();
                        }

                        redefineScrollPositionFlag = null;
                        el = null;
                    });
                } else if((delta <= offset) && scrollOnBottomAction){
                    disableVScrollListener();
                    if(shouldRedefineScrollPosition) {
                        el = getElementOn(SCROLL_POSITION.BOTTOM);
                    }

                    $timeout(function(){

                        redefineScrollPositionFlag = $scope.$apply(scrollOnBottomAction);
                        redefineScrollPositionFlag = (
                            Utils.isBoolean(redefineScrollPositionFlag) ? redefineScrollPositionFlag : false
                        );

                        if(shouldRedefineScrollPosition && redefineScrollPositionFlag) {
                            redefineScrollPosition(SCROLL_POSITION.BOTTOM, el);
                        } else {
                            enableVScrollListener();
                        }

                        redefineScrollPositionFlag = null;
                        el = null;
                    });
                }

                delta = null;
                offset = null;
            }

            function verticalScrollHandler(){
                if(verticalScrollTimeout){
                    $timeout.cancel(verticalScrollTimeout);
                    verticalScrollTimeout = null;
                } else {
                    verticalScrollTopInitialPositon = scrollable.scrollTop;
                }

                verticalScrollTimeout = $timeout(function(){
                    verticalScrollTimeout = null;
                    doVerticalScrollCheck();
                }, 20);
            }

            // @end: scroll
            //---

            function checkAttrs(){
                if(angular.isDefined($attrs[ATTRS.CHECK_WIDTH])){
                    // if `fixed-header-check-width` is present
                    // this makes the code flow check the windows width on resize
                    checkWindowWidthFlag = true;

                    var value = $attrs[ATTRS.CHECK_WIDTH];
                    if(Utils.isInteger(value)){
                        value = parseInt(value);
                        // use defined value if greater than 1000px, else use default value (1300px)
                        checkMinWidthValue = (value > 1000) ? value : checkMinWidthValue;
                    }
                    value = null;
                }

                // fixed-header-scroll-on-top
                if(angular.isDefined($attrs[ATTRS.SCROLL.ON_TOP])){
                    scrollOnTopAction = $attrs[ATTRS.SCROLL.ON_TOP];
                }

                // fixed-header-scroll-on-bottom
                if(angular.isDefined($attrs[ATTRS.SCROLL.ON_BOTTOM])){
                    scrollOnBottomAction = $attrs[ATTRS.SCROLL.ON_BOTTOM];
                }

                // fixed-header-scroll-redefine-position
                if(ATTRS.SCROLL.REDEFINE_POSITION in $attrs){
                    shouldRedefineScrollPosition = true;
                }

                // fixed-header-row-classname
                if(angular.isDefined($attrs[ATTRS.ROW_CLASSNAME])){
                    rowClassname = $attrs[ATTRS.ROW_CLASSNAME];
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
                    scrollable.className = (scrollable.className||'') + ' fixed-header-scrollable';
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

                    if(scrollOnTopAction || scrollOnBottomAction){
                        $scrollable.on('scroll', verticalScrollHandler);
                    }

                    // initial size definitions
                    $timeout(function(){
                        $scrollable.css({
                            display: 'block',
                            minWidth: '100%',
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            position: 'absolute'
                        });

                        var height = Utils.getHeight(wrap);
                        scrollable.style.height = (height  + 'px');
                        wrap.style.height = (height + 'px');
                        height = null;
                    });
                });
            }

            //---

            (function initFlow(){
                checkAttrs();
                checkWindowWidth(); // this should be called after check attributes
                rebuildDOMTree();

                //---

                var rowClassnameObserve = $attrs.$observe(ATTRS.ROW_CLASSNAME, function(newValue){
                    rowClassname = newValue;
                });

                //---

                $($window).on('resize', resizeHandler);
                var afterReloadDataListener = $scope.$on(EVENTS.NG_TABLE, delayTransformTable);
                var updateTableListener = $scope.$on(EVENTS.FIXED_HEADER.UPDATE_TABLE, delayTransformTable);
                var scrollToTopListener = $scope.$on(EVENTS.FIXED_HEADER.SCROLL_TO_TOP, function(){
                    disableVScrollListener();
                    scrollToPosition(0);
                    enableVScrollListener();
                });

                // wait for data to load and then transform the table
                var tableDataLoadedWatch = $scope.$watch(tableDataLoaded, function(isTableDataLoaded) {
                    if (isTableDataLoaded) {
                        transformTable();
                    }
                });

                $scope.$on('$destroy', function(){

                    rowClassnameObserve();
                    rowClassnameObserve = null;

                    $($window).off('resize', resizeHandler);
                    afterReloadDataListener();
                    afterReloadDataListener = null;
                    updateTableListener();
                    updateTableListener = null;
                    scrollToTopListener();
                    scrollToTopListener = null;
                    tableDataLoadedWatch();
                    tableDataLoadedWatch = null;

                    if(scrollOnTopAction || scrollOnBottomAction){
                        $scrollable.off('scroll', verticalScrollHandler);
                    }

                    //---

                    // cleanup variables
                    checkMinWidthValue = null;
                    rowClassname = null;

                    elem = null;
                    wrap = null;
                    $scrollable = null;
                    scrollable = null;

                    checkWindowWidthFlag = null;
                    defineColumnWidthFlag = null;
                    resizeTimeout = null;
                    viewHeight = null;
                    lastWindowHeight = null;

                    delayTransformTable = null;

                    shouldRedefineScrollPosition = null;
                    verticalScrollTimeout = null;
                    scrollOnTopAction = null;
                    scrollOnBottomAction = null;
                });
            })();
        }

        // directive config
        return {
            restrict: 'A',
            link: postLink
        };
    }

    fixedHeader.$inject = ['$timeout', '$window', '$q', '$rootScope'];

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
     *
     *     fixed-header-scroll-on-top="ctrl.onScrollTopAction()"
     *       define one action handler to scroll top event
     *
     *     fixed-header-scroll-on-bottom="ctrl.onScrollBottomAction()"
     *       define one action handler to scroll bottom event
     *
     *     fixed-header-scroll-redefine-position
     *       if present, redefine the scroll position after call the scroll action callback
     *
     *     fixed-header-row-classname="rowClassName"
     *       define the class used on tbody TRs
     *
     *   -->
     * >
     *   <!-- table content -->
     * </table>
     */
    angular
        .module('anguFixedHeaderTable', [])
        .directive('fixedHeader', fixedHeader);
})();
