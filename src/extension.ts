'use strict';


import * as vscode from 'vscode';
import { Uploader } from './lib/uploader';

export function activate(context: vscode.ExtensionContext) {

    let uploader: Uploader = new Uploader();

    let uploadFromFileDisp = vscode.commands.registerCommand('qiniu-uploader.uploadFromFile', () => {
        // handle upload from file
        uploader.uploadFromFile();
    });

    let uploadFromClipDisp = vscode.commands.registerCommand('qiniu-uploader.uploadFromClipboard', () => {
        // handle upload from clipboard
        uploader.uploadImageFromClipboard();
    });

    context.subscriptions.push(uploader);
    context.subscriptions.push(uploadFromFileDisp);
    context.subscriptions.push(uploadFromClipDisp);
}

export function deactivate() {
}