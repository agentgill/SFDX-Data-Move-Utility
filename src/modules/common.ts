/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { List } from 'linq.ts';
import * as fs from 'fs';
import path = require('path');
import parse = require('csv-parse/lib/sync');
import glob = require("glob");
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
import SimpleCrypto from "simple-crypto-js";


export class CommonUtils {

    public static trimEndStr(str: string, toTrim: string): string {
        if (str.endsWith(toTrim)) {
            return str.substring(0, str.lastIndexOf(toTrim));
        } else {
            return str;
        }
    }

    /**
     * 
     * @param array Asynchronous version of Array.ForEach()
     */
    public static async forEachAsync(array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }

    /**
     * Copies all properties from source to target that exist in the source object but empty in the target one
     */
    public static mergeObjectsEmptyProps(source: object, target: object): object {
        return {
            ...source,
            ...Reflect.ownKeys(target).filter(k => target[k] || target[k] == false).reduce((res, curr) => ({ ...res, [curr]: target[curr] }), {})
        };
    }


    /**
    * Clones list of objects by creating a new one.
    * Each item of the new list is a clone of the original one 
    * and has no properties that marked as to be omited.
    */
    public static cloneListOmitProps(items: List<object>, propsToOmit: Array<string>): List<object> {
        var props = propsToOmit.map((prop) => {
            return "'" + prop + "': " + prop.replace(/[\.]/g, "");
        }).join(",");
        var func = new Function("item", `return (({ ${props}, ...x }) => ({ ...x }))(item)`);
        return items.Select(item => func(item));
    }

    /**
     * Filters array by another array
     */
    public static filterArray<T>(array: Array<T>, remove: Array<T>): Array<T> {
        return array.filter(x => remove.indexOf(x) < 0);
    }


    /**
     * Splits array to multiple lists by max chunk size
     */
    public static chunkArrayToLists(list: Array<any>, chunkMaxSize: number): List<Array<any>> {
        var i, j, lst: List<Array<any>> = new List<Array<any>>();
        for (i = 0, j = list.length; i < j; i += chunkMaxSize) {
            lst.Add(list.slice(i, i + chunkMaxSize));
        }
        return lst;
    }

    /**
     * Displays difference between two dates in format [HH:mm:ss.mmm]
     */
    public static timeDiffString(start: Date, end: Date): string {
        var duration = Math.abs(end.getTime() - start.getTime());
        var milliseconds = (duration % 1000)
            , seconds = (duration / 1000) % 60
            , minutes = (duration / (1000 * 60)) % 60
            , hours = (duration / (1000 * 60 * 60)) % 24;
        return this.pad(Math.floor(hours), 2)
            + "h " + this.pad(Math.floor(minutes), 2)
            + "m " + this.pad(Math.floor(seconds), 2)
            + "s " + this.pad(Math.floor(milliseconds), 3)
            + "ms ";
    }

    /**
     * Converts number to string with leading zerros
     */
    public static pad(num: number, size: number): string {
        var s = String(num);
        while (s.length < (size || 2)) { s = "0" + s; }
        return s;
    }

    /**
     * Formats date to string [d/MM/yyyy HH:mm:ss:mmm]
     */
    public static formatDateTime(date: Date, addMs: boolean = true): string {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        var ms = date.getMilliseconds();
        hours = hours % 24;
        var strTime = this.pad(hours, 2) + ':' + this.pad(minutes, 2) + ':' + this.pad(seconds, 2) + (addMs ? "." + this.pad(ms, 3) : "");
        return date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear() + "  " + strTime;
    }

    /**
     * Formats date to string [d_MM_yyyy_HH_mm_ss ]
     */
    public static formatFileDate(date: Date) {
        return this.formatDateTime(date, false).replace(/[:]/g, "_").replace(/\s/g, "_").replace(/[/]/g, "_");
    }

    /**
     * Compares all props of two objects
     */
    public static areEqual(a: Object, b: Object, omitProps: string[] = new Array<string>()): boolean {
        for (var key in a) {
            if ((!(key in b) || a[key] != b[key] && (a[key] || b[key])) && omitProps.indexOf(key) < 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Checks object if it's string
     */
    public static isString(value: any): boolean {
        return typeof value == "string";
    }

    /**
     * Enters value from the console
     */
    public static async promptUser(message: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Prompt to stop the entire job
            readline.question(message, (ans) => {
                readline.close();
                resolve(ans);
            });
        });
    }


    /**
     * Reads csv files
     * Can read or entire file or wanted amount of lines
     */
    public static async readCsvFile(fileName: string, getSpecificLinesAmount: number = 0): Promise<Array<object>> {

        return new Promise<Array<object>>(resolve => {

            if (!fs.existsSync(fileName)) {
                resolve(new Array<object>());
                return;
            }

            if (getSpecificLinesAmount == 0) {
                let input = fs.readFileSync(fileName, 'utf8');
                const records = parse(input, {
                    columns: true,
                    skip_empty_lines: true,
                    cast: function (value, context) {
                        if (!value)
                            return null;
                        return value;
                    }
                });
                resolve([...records]);
            } else {

                let lineReader = require('readline').createInterface({
                    input: require('fs').createReadStream(fileName),
                });

                let lineCounter = 0; let wantedLines = [];

                lineReader.on('line', function (line) {
                    lineCounter++;
                    wantedLines.push(line);
                    if (lineCounter == getSpecificLinesAmount) {
                        lineReader.close();
                    }
                });

                lineReader.on('close', function () {
                    if (wantedLines.length == 1) {
                        let output = [wantedLines[0].split(',').reduce((acc, field) => {
                            acc[field] = null;
                            return acc;
                        }, {})];
                        resolve(output);
                        return;
                    }
                    let input = wantedLines.join('\n');
                    const records = parse(input, {
                        columns: true,
                        skip_empty_lines: true
                    });
                    resolve([...records]);
                });

            }

        });
    }


    public static async writeCsvFile(fileName: string, data: Array<object>): Promise<void> {
        if (!data || data.length == 0) return;
        const csvWriter = createCsvWriter({
            header: Object.keys(data[0]).map(x => {
                return {
                    id: x,
                    title: x
                }
            }),
            path: fileName
        });
        return csvWriter.writeRecords(data);
    }


    /**
     * Reads list of all files in dir by given mask
     * @param dir directory
     * @param fileMask  mask ex. *.txt
     */
    public static listDirAsync(dir: string, fileMask: string = "*"): Promise<Array<string>> {
        return new Promise<Array<string>>(resolve => {
            let fn = path.join(dir, fileMask);
            glob(fn, undefined, function (er, files) {
                resolve(files);
            });
        });
    }

    static counter;

    public static resetCasualCounter() {
        this.counter = {
            counter: {}
        };
    }

    public static createMockCustomFunctions(casual) {

        let _this = this;

        casual.define('c_seq_number', function (field, prefix, from, step) {
            if (!_this.counter.counter[field]) {
                _this.counter.counter[field] = +from || 1;
            } else {
                _this.counter.counter[field] = (+_this.counter.counter[field]) + step
            }
            return prefix + _this.counter.counter[field];
        });

        casual.define('c_seq_date', function (field, from, step) {
            step = step || "d";
            if (!_this.counter.counter[field]) {
                if (!(from instanceof Date)) {
                    from = new Date(Date.parse(from));
                }
                _this.counter.counter[field] = (from instanceof Date ? from : new Date())
            } else {
                switch (step) {
                    case "d":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setDate(_this.counter.counter[field].getDate() + 1));
                        break;
                    case "-d":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setDate(_this.counter.counter[field].getDate() - 1));
                        break;

                    case "m":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMonth(_this.counter.counter[field].getMonth() + 1));
                        break;
                    case "-m":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMonth(_this.counter.counter[field].getMonth() - 1));
                        break;

                    case "y":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setFullYear(_this.counter.counter[field].getFullYear() + 1));
                        break;
                    case "-y":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setFullYear(_this.counter.counter[field].getFullYear() - 1));
                        break;

                    case "s":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setSeconds(_this.counter.counter[field].getSeconds() + 1));
                        break;
                    case "-s":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setSeconds(_this.counter.counter[field].getSeconds() - 1));
                        break;

                    case "ms":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMilliseconds(_this.counter.counter[field].getMilliseconds() + 1));
                        break;
                    case "-ms":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMilliseconds(_this.counter.counter[field].getMilliseconds() - 1));
                        break;


                    default:
                        break;
                }
            }
            return new Date(_this.counter.counter[field].getTime());
        });
    }


    public static decryptRecords(records: Array<object>, password?: string): Array<object> {
        if (!password)
            return records;
        var simpleCrypto = new SimpleCrypto(password);
        let keys = [...Object.keys(records[0])];
        records.forEach(record => {
            keys.forEach(key => {
                if (key) {
                    let v = record[key] ? simpleCrypto.decrypt(record[key]) : record[key];
                    if (v)
                        record[key] = v;
                    else
                        record[key] = null;
                }
            });
        });
        return records;
    }


    public static encryptRecords(records: Array<object>, password?: string): Array<object> {
        if (!password)
            return records;
        var simpleCrypto = new SimpleCrypto(password);
        let keys = [...Object.keys(records[0])];
        records.forEach(record => {
            keys.forEach(key => {
                if (key) {
                    let v = record[key] ? simpleCrypto.encrypt(record[key]) : record[key];
                    if (v)
                        record[key] = v;
                }
            });
        });
        return records;
    }

}
