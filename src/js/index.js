(function () {
    // Global scope variables.
    var stage, map, column, columnFirst, columnSecond, donut, columnLabel;
    var mapSeries;
    var mapData, columnDataFirst, columnDataSecond, donutData;

    /**
     * Result of preprocessing to initialize UI controls.
     * @type {DataState}
     */
    var dataProcessedState = {
        years: [],
        regions: [],
        products: []
    };

    /**
     * Current state of data to filter it correctly.
     * @type {DataState}
     */
    var dataFilteredState = {
        years: [],
        regions: [],
        products: []
    };

    /**
     * Current state for drill down
     * @type {boolean}
     */
    var isDrillDown = false;

    // Document ready entry point.
    anychart.onDocumentReady(function () {
        preprocessData();
        initUI();

        applyFilters();
        initCharts();

        // event to reset button
        $('#reset-btn').on('click', function () {
            $('.filter-select').each(function () {
                $(this).multiselect('selectAll', false)
                    .multiselect('enable')
                    .multiselect('refresh');

                isDrillDown = false;

                preprocessData();
                applyFilters();

                columnLabel.enabled(false);
            });
        });
    });

    // Charts
    function initCharts() {
        var $filterByYears = $('#filter-years');
        var filteredByYearsValue;

        anychart.theme(anychart.themes.lightBlue);
        stage = anychart.graphics.create('container');
        stage.suspend();

        var scale = anychart.scales.linear();
        column = anychart.column();
        column.bounds(0, 0, '100%', '50%');
        column.yAxis(0)
            .title('Total products amount by years')
            .orientation('left');
        column.yAxis(1)
            .title('Total revenue by years')
            .orientation('right')
            .scale(scale)
            .labels({format: '${%Value}'});
        columnFirst = column.column()
            .data(columnDataFirst)
            .name('Total amount');
        columnFirst.tooltip().format('Total amount: {%Value}');
        columnSecond = column.column()
            .data(columnDataSecond)
            .name('Total revenue');
        columnSecond.tooltip().format('Total revenue: ${%Value}');
        columnSecond.yScale(scale);

        // create column label
        columnLabel = column.label(0);
        columnLabel.enabled(false)
            .text('Back to Years')
            .background('#fff')
            .fontColor('#37474f')
            .padding(5)
            .anchor('centerTop')
            .position('centerTop')
            .offsetY(10);

        columnLabel.listen('click', function () {
            columnLabel.enabled(false);

            $filterByYears.val(filteredByYearsValue)
                .multiselect('enable')
                .multiselect('refresh');

            isDrillDown = false;
            dataFilteredState.years = filteredByYearsValue;

            applyFilters();
        });

        columnLabel.listen('mouseOver', function () {
            this.background(anychart.color.darken('#fff', 0.35));
        });

        columnLabel.listen('mouseOut', function () {
            this.background('#fff');
        });

        donut = anychart.pie(donutData);
        donut.innerRadius('30%');
        donut.bounds(0, '50%', '50%', '50%');
        donut.title('Products distribution');
        donut.labels().fontColor('#fff');

        donut.legend()
            .width(385)
            .position('bottom');
            // .itemsLayout('vertical');
            // .positionMode('inside');
        donut.fill(function () {
                var exploded = this.iterator.meta('exploded');
                return exploded ? anychart.color.lighten(this.sourceColor, 0.25) : anychart.color.darken(this.sourceColor, 0.25);
            })
            .stroke(function () {
                var exploded = this.iterator.meta('exploded');
                return exploded ? this.sourceColor : anychart.color.darken(this.sourceColor, 0.25);
            });

        map = anychart.map();
        map.geoData(anychart.maps.united_states_of_america);
        map.bounds('50%', '50%', '50%', '50%');
        map.title('Distribution by regions');
        map.unboundRegions()
            .fill('#bbb')
            .stroke('#cfd8dc');
        mapSeries = map.choropleth(mapData);
        mapSeries.geoIdField('code_hasc');

        column.container(stage).draw();
        donut.container(stage).draw();
        map.container(stage).draw();

        stage.resume();

        column.listen('pointClick', function (e) {
            filteredByYearsValue = $filterByYears.val().map(function (value) {
                return +value
            });

            // Deselects selected points
            columnFirst.unselect();
            columnSecond.unselect();

            columnLabel.enabled(true);

            if (!isDrillDown) {
                dataFilteredState.years = [+e.point.get('x')];
                isDrillDown = true;
                applyFilters();

                $filterByYears.val(dataFilteredState.years)
                    .multiselect('refresh')
                    .multiselect('disable');
            }
        });

        map.listen('pointClick', function (e) {
            // Deselects selected points
            mapSeries.unselect();

            dataFilteredState.regions = [e.point.get('id')];
            applyFilters();

            $('#filter-regions').val(dataFilteredState.regions)
                .multiselect('refresh');
        });

        donut.listen('pointsSelect', updateDataFilteredStateByDonat);
        donut.listen('legendItemClick', updateDataFilteredStateByDonat);

        function updateDataFilteredStateByDonat() {
            updateLegend();

            var selectedPoints = [];
            var iterator = donut.data().getIterator();

            while (iterator.advance()) {
                if (iterator.meta('exploded')) {
                    selectedPoints.push(iterator.get('x'));
                }
            }

            if (!selectedPoints.length) {
                iterator.reset();
                while (iterator.advance()) {
                    selectedPoints.push(iterator.get('x'));
                }
            }

            dataFilteredState.products = selectedPoints;
            applyFilters(donut);

            var $filterByProducts = $('#filter-products');
            $filterByProducts.val(selectedPoints);
            $filterByProducts.multiselect('refresh');
        }

        function updateLegend() {
            donut.legend(false);
            donut.legend(true);
        }
    }

    /**
     * Applies filtering.
     * @param chart
     */
    function applyFilters(chart) {
        var columnDataMap = {}; //{year: sumOfCounts}
        var donutDataMapFirst = {}; //{product: sumOfCounts}
        var mapDataMap = {}; //{region: sumOfCounts}
        var donutDataMapSecond = {}; //{region: sumOfCounts}
        columnDataFirst = [];
        mapData = [];
        donutData = [];
        columnDataSecond = [];

        for (var i = 0; i < rawData.length; i++) {
            var data = rawData[i];
            var year = extractYear(data.date);
            var month = extractMonth(data.date);
            var product = data.product;
            var region = data.region;
            var price = data.price;
            var count;

            if (arrayContains(dataFilteredState.years, year) &&
                arrayContains(dataFilteredState.products, product) &&
                arrayContains(dataFilteredState.regions, region)) {

                count = data.count;

                if (isDrillDown) {
                    if (month in columnDataMap)
                        columnDataMap[month] += count;
                    else
                        columnDataMap[month] = count;

                    if (month in donutDataMapSecond)
                        donutDataMapSecond[month] += price;
                    else {
                        donutDataMapSecond[month] = price;
                    }
                } else {
                    if (year in columnDataMap)
                        columnDataMap[year] += count;
                    else
                        columnDataMap[year] = count;

                    if (year in donutDataMapSecond)
                        donutDataMapSecond[year] += price;
                    else {
                        donutDataMapSecond[year] = price;
                    }
                }

                if (product in donutDataMapFirst)
                    donutDataMapFirst[product] += count;
                else
                    donutDataMapFirst[product] = count;
            }

            if (arrayContains(dataFilteredState.years, year) &&
                arrayContains(dataFilteredState.products, product)) {
                count = data.count;

                if (region in mapDataMap)
                    mapDataMap[region] += count;
                else
                    mapDataMap[region] = count;
            }
        }

        if (isDrillDown) {
            columnDataMap = sortByMonth(columnDataMap);
            donutDataMapSecond = sortByMonth(donutDataMapSecond);
        }

        var key;
        for (key in columnDataMap) {
            if (columnDataMap.hasOwnProperty(key)) {
                columnDataFirst.push({x: key, value: columnDataMap[key]});
            }
        }
        for (key in donutDataMapFirst) {
            if (donutDataMapFirst.hasOwnProperty(key)) {
                donutData.push({x: key, value: donutDataMapFirst[key]});
            }
        }
        for (key in mapDataMap) {
            if (mapDataMap.hasOwnProperty(key)) {
                if (dataFilteredState.regions.indexOf(key) !== -1) {
                    mapData.push({
                        id: key,
                        name: key,
                        value: mapDataMap[key],
                        selectFill: anychart.color.lighten('#64b5f6', 0.25),
                        fill: anychart.color.lighten('#64b5f6', 0.25),
                        selectStroke: '#84c0f0'
                    });
                } else {
                    mapData.push({
                        id: key,
                        name: key,
                        value: mapDataMap[key],
                        fill: anychart.color.darken('#64b5f6', 0.25),
                        selectFill: '#757575',
                        selectStroke: null,
                        stroke: anychart.color.lighten('#64b5f6', 0.25)
                    });
                }
            }
        }
        for (key in donutDataMapSecond) {
            if (donutDataMapSecond.hasOwnProperty(key)) {
                columnDataSecond.push({x: key, value: donutDataMapSecond[key]});
            }
        }

        if (column) {
            columnFirst.data(columnDataFirst);
            columnSecond.data(columnDataSecond);
        }

        if (donut && !chart)
            donut.data(donutData);
        if (map)
            map.data(mapData);
    }

    /**
     * Prepares raw data.
     */
    function preprocessData() {
        for (var i = 0; i < rawData.length; i++) {
            var data = rawData[i]; //rawData is initialized in data.js
            insertInArray(dataProcessedState.regions, data.region);
            insertInArray(dataProcessedState.products, data.product);
            insertInArray(dataProcessedState.years, extractYear(data.date));
            insertInArray(dataFilteredState.regions, data.region);
            insertInArray(dataFilteredState.products, data.product);
            insertInArray(dataFilteredState.years, extractYear(data.date));
        }
        sortDataState(dataProcessedState);
    }

    /**
     * Initializes UI filtering controls.
     */
    function initUI() {
        initMultiselect('#filter-years', 'years');
        initMultiselect('#filter-products', 'products');
        initMultiselect('#filter-regions', 'regions');
    }

    /**
     * Initializes multiselect element.
     * @param {string} domId - DOM element id to initialize.
     * @param {string} fieldName - Field name in dataProcessedState to work with.
     */
    function initMultiselect(domId, fieldName) {
        var groupId = domId + '-all';
        var scope = dataProcessedState[fieldName];
        for (var i = 0; i < scope.length; i++) {
            var val = String(scope[i]);
            var option = $('<option>');
            option.attr('value', val).attr('selected', 'selected').html(val);
            $(groupId).append(option);
        }
        $(domId).multiselect({
            maxHeight: 240,
            onChange: function (opt, checked) {
                for (var i = 0; i < opt.length; i++) {
                    var val = $(opt).eq(i).val();
                    var testNumber = +val;
                    var resultVal = isNaN(testNumber) ? val : testNumber;

                    if (checked) {
                        insertInArray(dataFilteredState[fieldName], resultVal);
                        sortDataState(dataFilteredState, fieldName);
                    } else {
                        removeFromArray(dataFilteredState[fieldName], resultVal)
                    }
                }
                applyFilters();
            }
        });
    }

// region -- Utils.
    /**
     * Checks whether array contains value.
     * @param {Array} arr - Array.
     * @param {*} value - Value.
     * @return {boolean}
     */
    function arrayContains(arr, value) {
        return arr.indexOf(value) >= 0;
    }

    /**
     * Inserts in array if element not exists.
     * @param {Array} arr - Array.
     * @param {*} value - Value to insert.
     */
    function insertInArray(arr, value) {
        if (!arrayContains(arr, value))
            arr.push(value);
    }

    /**
     * Removes value from array.
     * @param {Array} arr - Array.
     * @param {*} value - Value to remove.
     */
    function removeFromArray(arr, value) {
        var index = arr.indexOf(value);
        if (index >= 0)
            arr.splice(index, 1);
    }

    /**
     * Extracts year from date passed.
     * @param {number} timestamp - Timestamp.
     * @return {number} - Year.
     */
    function extractYear(timestamp) {
        var date = new Date(timestamp);
        return date.getFullYear();
    }

    /**
     * Get month array
     * @returns {string[]}
     */
    function getMonth() {
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }

    /**
     * Extracts month from date passed.
     * @param {number} timestamp - Timestamp.
     * @return {number} - Month.
     */
    function extractMonth(timestamp) {
        var date = new Date(timestamp);
        var months = getMonth();
        return months[date.getMonth()];
    }

    /**
     * Sort object by month
     * @param obj
     * @returns {{}}
     */
    function sortByMonth(obj) {
        var months = getMonth();
        var result = {};

        for (var i = 0; i < months.length; i++) {
            if (obj.hasOwnProperty(months[i])) {
                result[months[i]] = obj[months[i]];
            }
        }

        return result
    }

    /**
     * Default compare function.
     * @param {*} a - First value.
     * @param {*} b - Second value.
     * @return {number} - Comparison result.
     */
    function compareFn(a, b) {
        if (a < b)
            return -1;
        if (a > b)
            return 1;
        return 0;
    }

    /**
     * Sorts dataState fields.
     * @param {DataState} dataState - Data state to sort.
     * @param {string=} opt_fieldToSort - Field to sort. If is not specified, sorts all fields.
     */
    function sortDataState(dataState, opt_fieldToSort) {
        if (opt_fieldToSort) {
            dataState[opt_fieldToSort].sort(compareFn);
        } else {
            dataState.years.sort(compareFn);
            dataState.products.sort(compareFn);
            dataState.regions.sort(compareFn);
        }
    }

    // region end -- Utils.
}());