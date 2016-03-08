/**
 * AngularJS fixed header scrollable table directive
 * @author Jason Watmore <jason@pointblankdevelopment.com.au> (http://jasonwatmore.com)
 * @version 1.2.0
 */
(function () {
    angular
        .module('anguFixedHeaderTable', [])
        .directive('fixedHeader', fixedHeader);

    fixedHeader.$inject = ['$timeout', '$window'];

    function debounce(func, wait, immediate) {
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
    };

    function fixedHeader($timeout, $window) {
        return {
            restrict: 'A',
            link: link
        };

        function link($scope, $elem, $attrs) {
            var elem = $elem[0];
            var wrap, $scrollable, scrollable;

            // for performance reasons, ignore events caused by rapidly repeating events
            // like animations
            var delayTransformTable = debounce(transformTable, 50);

            function getHeight(e) {
                e.style.display = 'none';
                var p = angular.element(e.parentElement);
                var height = window.innerHeight - p.offset().top - p.height();
                var i = p[0];
                while (i && i != document.body) {
                    try {
                        height -= parseFloat(window.getComputedStyle(i).paddingBottom.replace(/^(-?(?:\d)?(?:.\d+)?)[A-Za-z%]*$/, '$1'));
                    } catch (x) {}
                    i = i.parentElement;
                }
                e.style.display = '';
                return height;
            }

            if ($attrs.tableHeight === 'auto' || !$attrs.tableHeight) {
                $($window).on('resize', delayTransformTable);

                $scope.$on('$destroy', function () {
                    $($window).off('resize', delayTransformTable);
                });
            }

            $scope.$on('fixedHeader:updateTable', delayTransformTable);
            $scope.$on('ngTable:afterReloadData', delayTransformTable);

            // wait for data to load and then transform the table
            $scope.$watch(tableDataLoaded, function(isTableDataLoaded) {
                if (isTableDataLoaded) {
                    transformTable();
                }
            });

            // Clone the header and footer again using the shadowed table as reference
            function recloneHeaderAndFooter () {
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

            function tableDataLoaded() {
                // first cell in the tbody exists when data is loaded but doesn't have a width
                // until after the table is transformed
                var firstCell = elem.querySelector('tbody tr:first-child td:first-child');
                return firstCell && !firstCell.style.width;
            }

            function transformTable() {
                recloneHeaderAndFooter();
                // reset display styles so column widths are correct when measured below
                $timeout(function () {
                    if(!$elem.is(':visible')){
                        return;
                    }

                    var height = ($attrs.tableHeight === 'auto' || !$attrs.tableHeight) ?
                        getHeight(wrap) : $attrs.tableHeight;

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

                                el.style.width = cell.offsetWidth + 'px';
                                el.style.minWidth = '0px';
                                el.style.maxWidth = '100%';
                                rowWidth += cell.offsetWidth;
                            });
                            tableWidth = Math.max(tableWidth, rowWidth);
                        });
                        if (tableWidth > 0) {
                            shadows[index].style.width = tableWidth + 'px';
                        }
                    });
                    $scrollable.css({
                        display: 'block',
                        minWidth: '100%',
                        height: Math.min(height, elem.offsetHeight) - (wrap.offsetHeight - wrap.clientHeight) + 'px',
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        position: 'absolute'
                    });
                    if (wrap.offsetWidth < scrollable.offsetWidth) {
                        scrollable.style.paddingRight = (scrollable.offsetWidth - scrollable.clientWidth) + 'px';
                    } else {
                        scrollable.style.paddingRight = '0px';
                    }
                    wrap.style.height = Math.min(height, elem.offsetHeight) + 'px';
                });
            }
        }
    }
})();
