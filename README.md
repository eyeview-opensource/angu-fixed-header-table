angu-fixed-header-table
=======================

An AngularJS fixed header scrollable table directive

###Demo

To see a demo and further details go to http://pointblankdevelopment.com.au/blog/angularjs-fixed-header-scrollable-table-directive

###Installation

Install using bower: `bower install angu-fixed-header-table`

Alternatively download the code and include the angu-fixed-header-table.js file in your page.

Add the 'anguFixedHeaderTable' directive as a dependency of your AngularJS application:

```javascript
angular.module('myApp', ['anguFixedHeaderTable']);
```

###Usage

Simply add the *fixed-header* attribute to any tables you'd like to have a fixed header:

```html
<table fixed-header>
...
</table>
```

The table height can be set using CSS on the table element or by adding a *table-height* attribute to the table element eg: table-height="500px".

---

#### Detailed usage info:

```html
<table fixed-header>
  <!-- optional attributes:
    table-height="value", where value could be:
      auto - use the default calculation and get available space relative to windows height
      number - is define a number for example, 200, that will be in pixel
      80% - percentage heigh is also supported
      200px - define a string with the unit is also supported, where the unit could be `px` or `rem`

    fixed-header-check-width or fixed-header-check-width="1200"
      if present define the code flow to check window width and that
      will change the code flow to update the table header UI

    fixed-header-scroll-on-top="ctrl.onScrollTopAction()"
      define one action handler to scroll top event

    fixed-header-scroll-on-bottom="ctrl.onScrollBottomAction()"
      define one action handler to scroll bottom event

    fixed-header-scroll-redefine-position
      if present, redefine the scroll position after call the scroll action callback

    fixed-header-row-classname="rowClassName"
      define the class used on tbody TRs

  -->

  <!-- table content -->
</table>
 ```

 Also take a look on [Demo](demo) directory to see example of usage, if you have node.js in your computer you can use and run from root [[GitHub] indexzero / http-server](https://github.com/indexzero/http-server)