import * as SfdmModels from './models/index';

export const ALL_SUPPORTED_METADATA_TYPES = [
    "ApexTrigger",
    "WorkflowRule",
    "Flow",
    "ValidationRule",
    "LookupFilter"
];

export interface IPropertyChange {
    old: any;
    new: any;
    propertyName: string;
}

export class MetadataItem {

    constructor(init?: Partial<MetadataItem>) {
        Object.assign(this, init);
    }

    status: "Active" | "Inactive" | "Draft" | "Obsolete";

    fullName: string;
    objectName: string;
    type: string;
    id: string;
    meta: any;
    metaExt: any = undefined;
    sourceSOrg: SfdmModels.SOrg;

    changedProps: Array<IPropertyChange> = new Array<IPropertyChange>();

    get statusUpdated(): boolean {
        return this.changedProps.length > 0;
    }
}


export class MetadataApiSf {

    sOrg: SfdmModels.SOrg;

    /**
     * The map between sobject name and all the metadata related to this sobject
     *
     * @type {Map<String, Array<MetadataItem>>}
     * @memberof MetadataApiSf
     */
    objectNameToMetadataItemsMap: Map<String, Array<MetadataItem>> = new Map<String, Array<MetadataItem>>();

    constructor(sOrg: SfdmModels.SOrg) {
        this.sOrg = sOrg;
    }

    /**
     * Retrieves metadata of the given types.
     * Fills internal map of this.objectNameToMetadataItemsMap.
     * The method retrieves only unmanaged metadata.
     *
     * @param {Array<string>} metadataTypes The list of metadata types to retireve 
     *                                      See Salesforce Tooling Api documentation for the complete list of metadata types.
     *                                      (https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)
     *                                      Processes ALL_SUPPORTED_METADATA_TYPES only. 
     *                                      Other metadata types are ignored.
     * @param {Array<string>} objectNames The name of the objects to retireve metadata related to those objects.
     * @returns {Promise<any>} 
     * @memberof MetadataApiSf
     */
    async readMetadataAsync(metadataTypes: Array<string>, objectNames: Array<string>): Promise<any> {

        let _this = this;

        objectNames.forEach(name => {
            this.objectNameToMetadataItemsMap.set(name, new Array<MetadataItem>());
        });
        this.objectNameToMetadataItemsMap.set('Global', new Array<MetadataItem>());

        return new Promise<any>(resolve => {

            let promises = [];

            metadataTypes.forEach(metadataType => {

                if (ALL_SUPPORTED_METADATA_TYPES.indexOf(metadataType) >= 0) {

                    switch (metadataType) {

                        case "ApexTrigger":
                            promises = promises.concat(_this._getTriggersAsync(objectNames));
                            break;

                        case "WorkflowRule":
                            promises = promises.concat(_this._getWorkflowRulesAsync(objectNames));
                            break;

                        case "ValidationRule":
                            promises = promises.concat(_this._getValidationRulesAsync(objectNames));
                            break;

                        case "Flow":
                            promises = promises.concat(_this._getFlowsAsync());
                            break;

                        case "LookupFilter":
                            promises = promises.concat(_this._getLookupFiltersAsync(objectNames));
                            break;

                    }

                }

            });

            Promise.all(promises).then(function () {
                // TEST:
                let ee = _this.objectNameToMetadataItemsMap;
                resolve();
            });

        });
    }

    /**
     * Method to activate / deactivate given metadata items
     *
     * @param {Array<MetadataItem>} metdataItems Items to activate/ deactivate
     * @param {boolean} activate true - to activate metadata, false - to deactivate it
     * @returns {Promise<any>} 
     * @memberof MetadataApiSf
     */
    async activateOrDeactivateMetadataAsync(metdataItems: Array<MetadataItem>, activate: boolean): Promise<any> {

        let _this = this;

        return new Promise<any>(async resolve => {

            for (let index = 0; index < metdataItems.length; index++) {

                const itemToUpdate = metdataItems[index];

                switch (itemToUpdate.type) {

                    case "ApexTrigger":
                        // await this._metadataApi_UpdateOrgMetadataAsync(itemToUpdate, new Map([
                        //     ["status", activate ? "Active" : "Inactive"]
                        // ]));
                        break;

                    case "WorkflowRule":
                        await this._metadataApi_UpdateOrgMetadataAsync(itemToUpdate, new Map([
                             ["active", activate ? "true" : "false"]
                         ]));
                        break;

                    case "ValidationRule":

                        break;

                    case "Flow":

                        break;

                    case "LookupFilter":

                        break;

                }
            }

            resolve();

        });
    }


    // ----------------------- Private members -------------------------------------------
    private async _toolingApi_getMetadataAsync(
        metadataType: string,
        query: object,
        fields: Array<string>,
        fn: (metadata: any) => MetadataItem): Promise<Array<MetadataItem>> {

        let conn = this.sOrg.getConnection();
        let metadataItems = new Array<MetadataItem>();

        return new Promise<Array<MetadataItem>>(resolve => {
            conn.tooling.sobject(metadataType)
                .find(query, fields)
                .execute(function (err: any, metadata: any) {
                    if (err) {
                        resolve(metadataItems);
                        return;
                    }
                    metadata.forEach(meta => {
                        metadataItems.push(fn(meta));
                    });
                    resolve(metadataItems);
                });
        });
    }

    private async _toolingApi_getMetadataExtAsync(
        metadataType: string,
        metaItems: Array<MetadataItem>,
        fn: (metaItem: MetadataItem, metadata: any) => void): Promise<Array<any>> {

        return new Promise<Array<any>>(resolve => {

            let conn = this.sOrg.getConnection();
            let metaMap = new Map<string, MetadataItem>();

            metaItems.forEach(x => metaMap.set(x.fullName, x));

            conn.metadata.read(metadataType, [...metaMap.keys()], function (err: any, metadata: any) {
                if (err) {
                    resolve(new Array<any>());
                    return;
                }
                metadata.forEach(meta => {
                    fn(metaMap.get(meta.fullName), meta);
                });
                resolve(metadata);
            });
        });
    }

    private async _metadataApi_getMetadataOfTypeAsync(metadataType: string): Promise<Array<MetadataItem>> {

        let _this = this;

        return new Promise<Array<MetadataItem>>(resolve => {

            let conn = this.sOrg.getConnection();
            let metadataItems = new Array<MetadataItem>();

            conn.metadata.list({
                type: metadataType
            }, this.sOrg.version, function (err: any, metadata: any) {
                if (err || metadata.length == 0) {
                    resolve(metadataItems);
                    return;
                }
                metadata.forEach(meta => {
                    if (meta.manageableState == 'unmanaged') {
                        metadataItems.push(new MetadataItem({
                            sourceSOrg: _this.sOrg,
                            fullName: meta.fullName,
                            id: meta.id,
                            meta,
                            objectName: undefined,
                            status: undefined,
                            type: meta.type
                        }));
                    }
                });
                resolve(metadataItems);
            });
        });
    }


    private async _metadataApi_UpdateOrgMetadataAsync(itemToUpdate: MetadataItem, propMapToUpdate: Map<string, any>): Promise<any> {

        return new Promise<any>(async resolve => {

            itemToUpdate.changedProps = new Array<IPropertyChange>();

            if (ALL_SUPPORTED_METADATA_TYPES.indexOf(itemToUpdate.type) < 0) {
                resolve();
                return;
            }

            let metadata = {
                fullName: itemToUpdate.fullName
            };
            let keys = [...propMapToUpdate.keys()];
            keys.forEach(key => {
                metadata[key] = propMapToUpdate.get(key);
            });

            let conn = this.sOrg.getConnection();

            conn.metadata.update(itemToUpdate.type, [metadata], function (err: any, results: any) {

                if (err || results.length == 0 || !results[0].success) {
                    resolve();
                    return;
                }

                itemToUpdate.changedProps = keys.map(key => {
                    let ret = {
                        old: itemToUpdate[key],
                        new: propMapToUpdate.get(key),
                        propertyName: key
                    };
                    itemToUpdate[key] = ret.new;
                    return ret;
                });

                resolve();

            });
        });
    }


    // *********** Metadata Entities ***************
    private async _getTriggersAsync(objectNames: Array<string>): Promise<any> {

        let _this = this;

        return new Promise<any>(async resolve => {
            let metaItems = await this._toolingApi_getMetadataAsync("ApexTrigger", {
                ManageableState: 'unmanaged'
            }, [
                "TableEnumOrId",
                "Id",
                "Name",
                "Status"
            ], (meta: any) => new MetadataItem({
                sourceSOrg: _this.sOrg,
                type: "ApexTrigger",
                objectName: meta.TableEnumOrId,
                id: meta.Id,
                status: meta.Status,
                fullName: meta.Name,
                meta
            }));
            metaItems.forEach(metaItem => {
                if (objectNames.indexOf(metaItem.objectName) >= 0) {
                    this.objectNameToMetadataItemsMap.get(metaItem.objectName).push(metaItem);
                }
            });
            resolve();
        });
    }

    private async _getWorkflowRulesAsync(objectNames: Array<string>): Promise<any> {

        let _this = this;

        return new Promise<any>(async resolve => {
            let metaItems = await this._toolingApi_getMetadataAsync("WorkflowRule", {
                ManageableState: 'unmanaged'
            }, [
                "TableEnumOrId",
                "Id",
                "Name"
            ], (meta: any) => new MetadataItem({
                sourceSOrg: _this.sOrg,
                type: "WorkflowRule",
                objectName: meta.TableEnumOrId,
                id: meta.Id,
                fullName: meta.TableEnumOrId + "." + meta.Name,
                meta
            }));
            metaItems = metaItems.filter(metaItem => objectNames.indexOf(metaItem.objectName) >= 0);

            await this._toolingApi_getMetadataExtAsync("WorkflowRule", metaItems,
                (metaItem: MetadataItem, metadata: any) => {
                    metaItem.status = metadata.active == "true" ? "Active" : "Inactive";
                    metaItem.metaExt = metadata;
                });
            metaItems.forEach(metaItem => {
                this.objectNameToMetadataItemsMap.get(metaItem.objectName).push(metaItem);
            });
            resolve();
        });
    }

    private async _getFlowsAsync(): Promise<any> {

        return new Promise<any>(async resolve => {
            let metaItems = await this._metadataApi_getMetadataOfTypeAsync("Flow");
            await this._toolingApi_getMetadataExtAsync("Flow", metaItems,
                (metaItem: MetadataItem, metadata: any) => {
                    metaItem.status = metadata.status;
                    metaItem.metaExt = metadata;
                });
            this.objectNameToMetadataItemsMap.set("Global", this.objectNameToMetadataItemsMap.get("Global").concat(metaItems));
            resolve();
        });

    }

    private async _getValidationRulesAsync(objectNames: Array<string>): Promise<any> {

        let _this = this;

        return new Promise<any>(async resolve => {
            let metaItems = await this._toolingApi_getMetadataAsync("ValidationRule", {
                ManageableState: 'unmanaged'
            }, [
                "EntityDefinitionId",
                "Id",
                "ValidationName",
                "Active"
            ], (meta: any) => new MetadataItem({
                sourceSOrg: _this.sOrg,
                type: "ValidationRule",
                objectName: meta.EntityDefinitionId,
                id: meta.Id,
                status: meta.Active ? "Active" : "Inactive",
                fullName: meta.EntityDefinitionId + "." + meta.ValidationName,
                meta
            }));
            metaItems.forEach(metaItem => {
                if (objectNames.indexOf(metaItem.objectName) >= 0) {
                    this.objectNameToMetadataItemsMap.get(metaItem.objectName).push(metaItem);
                }
            });
            resolve();
        });

    }

    private async _getLookupFiltersAsync(objectNames: Array<string>): Promise<any> {

        let _this = this;

        return new Promise<any>(async resolve => {
            let metaItems = await this._toolingApi_getMetadataAsync("LookupFilter", {
                ManageableState: 'unmanaged'
            }, [
                "SourceFieldDefinitionId",
                "Id",
                "TargetEntityDefinitionId",
                "DeveloperName",
                "Active"
            ], (meta: any) => new MetadataItem({
                sourceSOrg: _this.sOrg,
                type: "LookupFilter",
                objectName: meta.SourceFieldDefinitionId.split('.')[0],
                id: meta.Id,
                status: meta.Active ? "Active" : "Inactive",
                fullName: meta.TargetEntityDefinitionId + "." + meta.DeveloperName,
                meta
            }));
            metaItems.forEach(metaItem => {
                if (objectNames.indexOf(metaItem.objectName) >= 0) {
                    this.objectNameToMetadataItemsMap.get(metaItem.objectName).push(metaItem);
                }
            });

            resolve();
        });
    }




}