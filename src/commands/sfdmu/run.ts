/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as SfdmModels from "../../modules/models";

import { FlagsConfig, SfdxCommand, flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';

import { AnyJson } from '@salesforce/ts-types';
import {
    MessageUtils,
    COMMON_RESOURCES,
    COMMAND_EXIT_STATUSES
} from "../../modules/messages";
import { RunCommand, RUN_RESOURCES } from "../../modules/commands/runCommand";
import { CommonUtils } from "../../modules/common";


Messages.importMessagesDirectory(__dirname);

const commandMessages = Messages.loadMessages('sfdmu', 'run');
const commonMessages = Messages.loadMessages('sfdmu', 'common');


export default class Run extends SfdxCommand {

    command: RunCommand;

    protected static supportsUsername = true;
    protected static requiresUsername = false;
    protected static varargs = false;

    public static description = commandMessages.getMessage('commandDescription');
    public static longDescription = commandMessages.getMessage('commandLongDescription');

    // TODO: Add deprecation to the command if neededsfdx sfdmu:
    // public static deprecated = {
    //     version: 47,
    //     to: 'force:package:create'
    // };

    protected static flagsConfig: FlagsConfig = {
        sourceusername: flags.string({
            char: "s",
            description: commandMessages.getMessage('sourceusernameFlagDescription'),
            longDescription: commandMessages.getMessage('sourceusernameFlagLongDescription'),
            default: '',
            // TODO: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        path: flags.directory({
            char: 'p',
            description: commandMessages.getMessage('pathFlagDescription'),
            longDescription: commandMessages.getMessage('pathFlagLongDescription'),
            default: '',
            // TODO: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        encryptkey: flags.string({
            description: commandMessages.getMessage('encryptKeyFlagDescription'),
            longDescription: commandMessages.getMessage('encryptKeyFlagLongDescription'),
            default: '',
            // TODO: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        verbose: flags.builtin({
            description: commandMessages.getMessage('verboseFlagDescription'),
            longDescription: commandMessages.getMessage('verboseFlagLongDescription')
        }),
        concise: flags.builtin({
            description: commandMessages.getMessage('conciseFlagDescription'),
            longDescription: commandMessages.getMessage('conciseFlagLongDescription'),
        }),
        quiet: flags.builtin({
            description: commandMessages.getMessage('quietFlagDescription'),
            longDescription: commandMessages.getMessage('quietFlagLongDescription'),
        }),
        silent: flags.boolean({
            description: commandMessages.getMessage("silentFlagDescription"),
            longDescription: commandMessages.getMessage("silentFlagLongDescription")
        }),
        version: flags.boolean({
            description: commandMessages.getMessage("versionFlagDescription"),
            longDescription: commandMessages.getMessage("versionFlagLongDescription"),
            // TODO: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        apiversion: flags.builtin({
            description: commandMessages.getMessage("apiversionFlagDescription"),
            longDescription: commandMessages.getMessage("apiversionFlagLongDescription")
        }),
        filelog: flags.boolean({
            description: commandMessages.getMessage("filelogFlagDescription"),
            longDescription: commandMessages.getMessage("filelogFlagLongDescription"),
            // TODO: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        noprompt: flags.boolean({
            description: commandMessages.getMessage("nopromptFlagDescription"),
            longDescription: commandMessages.getMessage("nopromptLongFlagDescription")
        }),
        json: flags.boolean({
            description: commandMessages.getMessage("jsonFlagDescription"),
            longDescription: commandMessages.getMessage("jsonLongFlagDescription"),
            default: false
        })
    };


    public async run(): Promise<AnyJson> {

        this.ux["isOutputEnabled"] = true;

        this.flags.verbose = this.flags.verbose && !this.flags.json;
        this.flags.quiet = this.flags.quiet || this.flags.silent || this.flags.version;
        this.flags.filelog = this.flags.filelog && !this.flags.version;

        let logger = new MessageUtils(
            commonMessages,
            commandMessages,
            this.ux,
            this.statics,
            this.flags.loglevel,
            this.flags.path,
            this.flags.verbose,
            this.flags.concise,
            this.flags.quiet,
            this.flags.json,
            this.flags.noprompt,
            this.flags.filelog);

        try {

            // Process --version flag
            if (this.flags.version) {

                let pinfo = CommonUtils.getPluginInfo(this.statics);

                // Exit - success
                logger.commandExitMessage(
                    RUN_RESOURCES.pluginVersion,
                    COMMAND_EXIT_STATUSES.SUCCESS,
                    undefined,
                    pinfo.pluginName, pinfo.version);

                process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
                // --
            }

            this.command = new RunCommand(logger);

            if (!this.flags.sourceusername) {
                throw new SfdmModels.CommandInitializationError(commandMessages.getMessage('errorMissingRequiredFlag', ['--sourceusername']));
            }

            if (!this.flags.targetusername) {
                throw new SfdmModels.CommandInitializationError(commandMessages.getMessage('errorMissingRequiredFlag', ['--targetusername']));
            }

            await this.command.initCommand(
                this.flags.path,
                this.flags.targetusername,
                this.flags.sourceusername,
                this.flags.encryptkey,
                this.flags.apiversion);

            await this.command.createMigrationJob();

            let commandResult = await this.command.executeMigrationJob();

            // Exit - success
            logger.commandExitMessage(
                commandResult || COMMON_RESOURCES.successfullyCompletedResult,
                COMMAND_EXIT_STATUSES.SUCCESS);

            process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
            // --

        } catch (e) {

            // Exit - error
            switch (e.constructor) {

                case SfdmModels.CommandInitializationError:
                    logger.commandExitMessage(
                        COMMON_RESOURCES.commandInitializationErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR);


                case SfdmModels.OrgMetadataError:
                    logger.commandExitMessage(
                        COMMON_RESOURCES.orgMetadataErrorResult,
                        COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR);


                case SfdmModels.CommandExecutionError:
                    logger.commandExitMessage(
                        COMMON_RESOURCES.commandExecutionErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR);


                case SfdmModels.UnresolvableWarning:
                    logger.commandExitMessage(
                        COMMON_RESOURCES.commandUnresolvableWarningResult,
                        COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING);


                case SfdmModels.CommandAbortedByUserError:
                    logger.commandExitMessage(
                        COMMON_RESOURCES.commandAbortedByUserErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER);


                default:
                    logger.commandExitMessage(
                        COMMON_RESOURCES.commandUnexpectedErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR);

            }
            // --
        }

        return {};
    }
}


