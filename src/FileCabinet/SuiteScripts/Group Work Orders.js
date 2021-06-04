/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/transaction','N/log','N/ui/serverWidget'],
    /**
 * @param{record} record
 * @param{search} search
 * @param{transaction} transaction
 */
    (record, search, transaction,log, serverWidget) => {
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

            var hasformulawo = rec.getValue('custbodyformulaworkorder')

            if (hasformulawo == ""){

                var formulaworkorderfield = scriptContext.form.getField({id:'custbodyformulaworkorder'});
                // formulaworkorderfield.isDisplay = false
                formulaworkorderfield.updateDisplayType({
                    displayType : serverWidget.FieldDisplayType.HIDDEN
                });
            }

            if (woid == ""){
                return
            }
            // log.debug('before search',woid)
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
                        search.createColumn({name: "internalid", label: "Internal ID"})
                    ]
            });
            var searchResultCount = workorderSearchObj.runPaged().count;

            if (searchResultCount > 0){
                // log.debug(searchResultCount)
                var currentform = scriptContext.form

                var parentsublist = currentform.addSublist({id:'custpageparentworkorders',type: serverWidget.SublistType.EDITOR,label:"Parent Work Orders"})
                parentsublist.addField({id:'parentwoname', label: 'Work Order',type: serverWidget.FieldType.SELECT, source: 'transaction'})

                var resultset = workorderSearchObj.run();
                var results = resultset.getRange(0, searchResultCount);
                for(var i in results){
                    var result = results[i];
                    for(var k in result.columns){
                        addtoparentwosublist(result.getValue(result.columns[k]), parentsublist, i);
                    }
                }
            }

            function addtoparentwosublist(parentwoid, parentsublist, i){
                // log.debug("will add to sublist", parentwoid)
                // log.debug("typei",typeof(i))
                parentsublist.setSublistValue({id: 'parentwoname',line: parseInt(i),value:parentwoid})
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
            // log.debug("heloo")
            Date.prototype.GetFirstDayOfWeek = function() {
                return (new Date(this.setDate(this.getDate() - this.getDay())));
            }

            Date.prototype.GetLastDayOfWeek = function() {
                return (new Date(this.setDate(this.getDate() - this.getDay() +6)));
            }

            var rec = scriptContext.newRecord
            var oldrec = scriptContext.oldRecord
            var woid = rec.getValue('id')

            var isnewandreleased = rec.getValue("id") == '' && rec.getValue("orderstatus") == "B"
            var oldrecisplanned;

            if (oldrec == null){
                oldrecisplanned = false;
            }else {
                oldrecisplanned = oldrec.getValue("orderstatus") == "A";
            }
            log.debug(oldrecisplanned);
            var wasplannedandnowreleased = oldrecisplanned && (rec.getValue("orderstatus") == "B")


            if (!isnewandreleased && !wasplannedandnowreleased){
                return
            }
            log.debug("Checking wo for assemblies")



            var itemlinecount = rec.getLineCount({sublistId:"item"});


            for (var i=0;i<itemlinecount;i++){
                var itemtype = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemtype',
                    line: i
                });

                var itemsource = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemsource',
                    line: i
                });

                // log.debug(itemsource,itemtype)


                if (itemtype == 'Assembly' && itemsource == "STOCK"){



                    var itemid = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemid',
                        line: i
                    });


                    var displayqty = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });

                    var conversionqty = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'unitconversionrate',
                        line: i
                    });

                    var qty = displayqty / conversionqty

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

            function updatevalues(){
                // log.debug("Not new Item")
            }

            function checkwo(itemid,qty,woid, name, wostartdate){

                // log.debug(itemid);
                // log.debug(datetoddmmyyyy(wostartdate));

                var tempdate = wostartdate
                var workorderSearchObj = search.create({
                    title: "sup",
                    type: "workorder",
                    filters:
                        [
                            ["type","anyof","WorkOrd"],
                            "AND",
                            ["startdate","within",datetoddmmyyyy(wostartdate.GetFirstDayOfWeek()),datetoddmmyyyy(wostartdate.GetLastDayOfWeek())],
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

                wostartdate = tempdate


                var searchResultCount = workorderSearchObj.runPaged().count;
                // log.debug(searchResultCount);
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
                // log.debug("creating wo", [itemid,qty,woid]);

                var newchildworkworder = record.create({
                        type: "workorder",
                        // isDynamic: true
                }
                );

                newchildworkworder.setValue("assemblyitem", itemid);
                newchildworkworder.setValue("subsidiary", "2");
                newchildworkworder.setValue("location", "5");
                // newchildworkworder.setValue("quantity", qty);
                newchildworkworder.setValue("startdate", new Date(wostartdate));
                newchildworkworder.setValue("orderstatus","A")
                newchildworkworder.setValue("createdfrom",woid)
                var newchildworkworderid = newchildworkworder.save()
                // log.debug("newchildworkworderid",newchildworkworderid)
                record.submitFields({type: 'workorder',id: newchildworkworderid,
                    values: {quantity:qty}})

                var parentwonum = rec.getValue('tranid')


                var parentbomid = rec.getValue("billofmaterials")
                var parentbomrec = record.load({type:"bom",id: parentbomid})
                var parentbomtype = parentbomrec.getValue("custrecordbomtype")

                if (parentbomtype == "1"){
                    record.submitFields({type: 'workorder',id: newchildworkworderid,
                        values: {tranid:parentwonum +"-FM"}})

                    record.submitFields({type: 'workorder',id: newchildworkworderid,
                        values: {custbody_mfgmob_workcenter:"1886"}})

                } else if (parentbomtype == "3"){

                    var spicebagrec = record.load({type:"lotnumberedassemblyitem",id: itemid})
                    var spicebagsuffix = "SB " + spicebagrec.getValue("itemid").match(/([A-z]*)$/)[0];
                    record.submitFields({type: 'workorder',id: newchildworkworderid,
                        values: {tranid: `${parentwonum.replace("-FM","")}-${spicebagsuffix}`}})

                    record.submitFields({type: 'workorder',id: newchildworkworderid,
                        values: {custbody_mfgmob_workcenter:"2211"}})
                }
                rec.setValue("custbodyformulaworkorder", newchildworkworderid)
                }




            function updateworkorder(childwo,itemid,qty,woid){
                // log.debug("updating wo", [childwo,itemid,qty,woid])

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
                // log.debug("oldchildworkworderid",oldchildworkworderid)
                rec.setValue("custbodyformulaworkorder", oldchildworkworderid)
                // rec.save()

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

        }

        return {
            beforeSubmit: beforeSubmit,
            beforeLoad: beforeLoad,
        };


    });
