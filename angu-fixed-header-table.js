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

    function fixedHeader($timeout, $window) {
        return {
            restrict: 'A',
            link: link
        };

        function link($scope, $elem, $attrs, $ctrl) {
            var elem = $elem[0];

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
                $($window).on('resize', transformTable);

                $scope.$on('$destroy', function () {
                    $($window).off('resize', transformTable);
                });
            }

            $scope.$on('ngTable:afterReloadData', transformTable);
            // wait for data to load and then transform the table
            $scope.$watch(tableDataLoaded, function(isTableDataLoaded) {
                if (isTableDataLoaded) {
                    transformTable();
                }
            });

            $timeout(function(){
                $elem.css({ position : 'relative' });
                angular.element(elem.querySelector('thead')).css({
                    position: 'absolute',
                    zIndex: 10
                });
            });

            function tableDataLoaded() {
                // first cell in the tbody exists when data is loaded but doesn't have a width
                // until after the table is transformed
                var firstCell = elem.querySelector('tbody tr:first-child td:first-child');
                return firstCell && !firstCell.style.width;
            }

            function transformTable() {
                // reset display styles so column widths are correct when measured below
                $timeout(function () {
                    angular.element(elem.querySelectorAll('tbody, tfoot, td, th, tr'))
                        .attr('style', '');
                    window.getComputedStyle(elem); // force re-render
                    var body = elem.querySelector('tbody');

                    if (!body) {
                        return;
                    }
                    var shadow = body.querySelectorAll('tr.my-shadow-head-row');
                    if (shadow.length > 0) {
                        angular.forEach(shadow, function(sh) {
                            sh.parentNode.removeChild(sh);
                        });
                    }
                    var clonedHead;
                    var clonedHeadLength = 0;
                    // Only partial support for multiple thead rows. May beed more work
                    _.forEachRight(elem.querySelectorAll('thead tr'), function (e) {
                        var c = e.cloneNode(true);
                        c.style.visibility = 'hidden';
                        c.style.borderBottom = '0';
                        c.className = c.className ? c.className + ' my-shadow-head-row' : 'my-shadow-head-row';
                        if (clonedHeadLength < c.querySelectorAll('th').length) {
                            clonedHead = c;
                            clonedHeadLength = c.querySelectorAll('th').length;
                        }

                        var firstRow = body.querySelector('tr:first-child');
                        if (firstRow) {
                            body.insertBefore(c, firstRow);
                        } else {
                            body.appendChild(c);
                        }
                    });




                    // wrap in $timeout to give table a chance to finish rendering

                    var height = ($attrs.tableHeight === 'auto' || !$attrs.tableHeight) ?
                    getHeight(elem) - angular.element(elem.querySelectorAll('thead')).height() - angular.element(elem.querySelectorAll('tfoot')).height() :
                        $attrs.tableHeight;

                    angular.element(elem.querySelectorAll('tbody')).css({
                        'display': 'block',
                        'height':  height,
                        'overflow': 'auto'
                    });
                    angular.element(elem.querySelector('tfoot')).css('display', 'block');

                    // set widths of columns
                    angular.forEach(clonedHead.querySelectorAll('th'), function (headElem, i) {

                        var thElem = elem.querySelector('thead tr th:nth-child(' + (i + 1) + ')');
                        var tfElems = elem.querySelectorAll('tfoot tr td:nth-child(' + (i + 1) + ')');


                        var columnWidth = headElem.offsetWidth;
                        if (thElem) {
                            thElem.style.width = columnWidth + 'px';
                            thElem.style.minWidth = '0px';
                            thElem.style.maxWidth = '100%';
                        }
                        if (tfElems.length > 0) {
                            angular.element(tfElems).css({
                                width : columnWidth + 'px',
                                minWidth : '0px',
                                maxWidth : '100%'
                            });
                        }
                    });
                });
            }
        }
    }
})();

