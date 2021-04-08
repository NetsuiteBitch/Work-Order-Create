/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/transaction','N/log'],
    /**
 * @param{record} record
 * @param{search} search
 * @param{transaction} transaction
 */
    (record, search, transaction,log) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            var rec = scriptContext.newRecord
            var woid = rec.getValue('id')
            var workorderSearchObj = search.create({
                type: "workorder",
                filters:
                    [
                        ["type","anyof","WorkOrd"],
                        "AND",
                        ["custbodyformulaworkorder","anyof",woid],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns:
                    [
                        search.createColumn({name: "tranid", label: "Document Number"})
                    ]
            });
            var searchResultCount = workorderSearchObj.runPaged().count;

            if (searchResultCount > 0){
                log.debug(searchResultCount)
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

            var rec = scriptContext.newRecord

            var itemlinecount = rec.getLineCount({sublistId:"item"});


            for (var i=0;i<itemlinecount;i++){
                var itemtype = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemtype',
                    line: i
                });


                if (itemtype == 'Assembly'){

                    var itemid = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemid',
                        line: i
                    });

                    var qty = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });

                    var name = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item_display',
                        line: i
                    });

                    var woid = rec.getValue('id')
                    var wostartdate = rec.getValue('startdate')

                    checkwo(itemid,qty,woid, name, wostartdate)


                }


            }

            function checkwo(itemid,qty,woid, name, wostartdate){

                log.debug(itemid);
                log.debug(datetoddmmyyyy(wostartdate));

                var workorderSearchObj = search.create({
                    title: "sup",
                    type: "workorder",
                    filters:
                        [
                            ["type","anyof","WorkOrd"],
                            "AND",
                            ["startdate","within",datetoddmmyyyy(wostartdate),datetoddmmyyyy(wostartdate)],
                            "AND",
                            ["mainline","is","T"],
                            "AND",
                            ["item","anyof",itemid]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "Internal ID"})
                        ]
                });


                var searchResultCount = workorderSearchObj.runPaged().count;
                log.debug(searchResultCount);
                if (searchResultCount == 1){
                    var resultset = workorderSearchObj.run();
                    var results = resultset.getRange(0, 1);
                    for(var i in results){
                        var result = results[i];
                        for(var k in result.columns){
                            updateworkorder(result.getValue(result.columns[k]), itemid, qty, woid);
                        }
                    }

                } else if (searchResultCount == 0) {
                    createworkorder (itemid,qty,woid, wostartdate)

                } else if (searchResultCount > 2) {

                    var resultset = workorderSearchObj.run();
                    var results = resultset.getRange(0, 2);
                    var arr = []
                    for(var i in results){
                        var result = results[i];
                        for(var k in result.columns){
                            arr.push(result.getValue(result.columns[k]));
                        }
                    }
                    log.debug("more than one work order", arr);

                }


            }

            function createworkorder(itemid,qty,woid, wostartdate){
                log.debug("creating wo", [itemid,qty,woid]);

                var newchildworkworder = record.create({
                        type: "workorder",
                        // isDynamic: true
                }
                );

                newchildworkworder.setValue("assemblyitem", itemid);
                newchildworkworder.setValue("subsidiary", "2");
                newchildworkworder.setValue("location", "5");
                newchildworkworder.setValue("quantity", qty);
                newchildworkworder.setValue("startdate", new Date(wostartdate));
                var newchildworkworderid = newchildworkworder.save()
                log.debug("newchildworkworderid",newchildworkworderid)
                rec.setValue("custbodyformulaworkorder", newchildworkworderid)
                // rec.save()

            }

            function updateworkorder(childwo,itemid,qty,woid){
                log.debug("updating wo", [childwo,itemid,qty,woid])

                var oldchildworkworder = record.load({
                        type: "workorder",
                        id: childwo

                    }
                );

                var oldqty = oldchildworkworder.getValue("quantity");
                var newqty = oldqty + qty;

                oldchildworkworder.setValue("quantity", newqty);
                oldchildworkworder.save()

                var oldchildworkworderid = oldchildworkworder.getValue('id')
                log.debug("oldchildworkworderid",oldchildworkworderid)
                rec.setValue("custbodyformulaworkorder", oldchildworkworderid)
                // rec.save()

            }



        }

        function datetoddmmyyyy(mydate) {
            var dd = mydate.getDate();
            var mm = mydate.getMonth() + 1;
            var yyyy = mydate.getFullYear();
            if (dd < 10) {
                dd = "0" + dd;
            }
            if (mm < 10) {
                mm = "0" + mm;
            }
            var formatteddate = mm + "/" + dd + "/" + yyyy;
            return formatteddate
        }


        return {
            beforeSubmit: beforeSubmit,
            beforeLoad: beforeLoad,
        };


    });
