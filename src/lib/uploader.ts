import { Disposable, WorkspaceConfiguration } from 'vscode';
import { QiNiuUploader, UploadResponse } from './qiniu-uploader';
import * as vscode from 'vscode';
import { Config } from './config';
import * as path from 'path';
import { saveClipboardToFile } from './image-clip';
import { tmpdir } from 'os'
import { renameSync, existsSync } from 'fs';
import { mkdirSync } from 'mkdir-recursive';

export class Uploader implements Disposable {

    private qiniu: QiNiuUploader;
    private config: Config;
    private disposable: Disposable;
    private lastNum: string;
    private lastNumChanged: boolean;
    private lastLocalFile: string;

    public constructor() {
        this.lastNum = '00';
        this.confChanged();
        let disposables: Disposable[] = [];
        vscode.workspace.onDidChangeConfiguration(this.confChanged, this, disposables);
        this.disposable = Disposable.from(...disposables);
        if (this.config.isOk()) {
            this.qiniu = new QiNiuUploader(this.config.ak, this.config.sk, this.config.bucket);
        }
    }

    private confChanged() {
        this.config = new Config(vscode.workspace.getConfiguration('qiniu-uploader'));
        if (this.qiniu) {
            this.qiniu.dispose();
        }
        if (this.config.isOk()) {
            this.qiniu = new QiNiuUploader(this.config.ak, this.config.sk, this.config.bucket);
        }
    }

    public uploadFromFile() {
        if (this.isNoSettings()) return;
        vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFolders: false,
            openLabel: 'Upload'
        }).then((files) => {
            if (!files || files.length < 1) {
                return;
            }
            vscode.window.showInformationMessage('Do you want to use the original file name?',
                'Yes', 'No').then((yesno) => {
                    return this.makeFileKey(
                        (yesno === 'Yes') ?
                            path.basename(files[0].fsPath) :
                            this.config.fileKeyPattern + path.extname(files[0].fsPath));
                }).then((key) => {
                    if (!key) {
                        return;
                    }
                    this.qiniu.upload(key, files[0].fsPath)
                        .then((res) => {
                            this.afterUploaded(files[0].fsPath, res);
                        });
                });
        });
    }

    public uploadImageFromClipboard() {
        if (this.isNoSettings()) return;
        let outDir = tmpdir();
        if (this.config.saveToLocal) {
            outDir = this.config.localPath;
            if (!path.isAbsolute(outDir)) {
                let workspaceRoot = vscode.workspace.workspaceFolders;
                if (!workspaceRoot || !workspaceRoot[0]) {
                    return vscode.window.showErrorMessage('Your localPath is relative path, so you must open a workspace.');
                }
                // get absolute path if it is relative path
                outDir = path.join(workspaceRoot[0].uri.fsPath, outDir);
            }
        }
        try {
            if (!existsSync(outDir)) {
                mkdirSync(outDir);
            }
        } catch (e) {
            return vscode.window.showErrorMessage(`Make output dir '${outDir}' failed.`);
        }
        saveClipboardToFile(path.join(outDir, new Date().getTime() + '.tmp')).then((r) => {
            if (!r.success) {
                return vscode.window.showErrorMessage(`Save file failed: ${r.error}`);
            }
            this.makeFileKey(this.config.fileKeyPattern).then((key) => {
                if (!key) {
                    return;
                }
                let dstFile = path.join(outDir, key + '.png');
                try {
                    if (!existsSync(path.dirname(dstFile))) {
                        mkdirSync(path.dirname(dstFile));
                    }
                    renameSync(r.file, dstFile);
                } catch (e) {
                    return vscode.window.showErrorMessage(`Save file '${dstFile}' failed.`);
                }
                this.qiniu.upload(key + path.extname(dstFile), dstFile).then((res) => {
                    this.afterUploaded(dstFile, res);
                });
            });
        });
    }

    private afterUploaded(file: string, res: UploadResponse) {
        if (!res.success) {
            return vscode.window.showErrorMessage(
                `Upload failed with code ${res.statusCode}: ${res.error}`);
        }
        // update input box value if necessary
        if (!this.lastNumChanged) {
            let tempLastNum = parseInt(this.lastNum);
            tempLastNum += 1;
            this.lastNum = (tempLastNum < 10 ? '0' : '') + tempLastNum;
        }
        let result = this.config.domain + res.key;
        vscode.window.showInformationMessage(`Upload successfully. The key is "${result}"`);
        // insert the file link
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit((edit) => {
                edit.insert(editor.selection.active, result);
            });
        }
    }

    private makeFileKey(key: string): Thenable<string> {
        return new Promise((resolve) => {
            if (key.indexOf('${') < 0) {
                return resolve(key);
            }
            let editor = vscode.window.activeTextEditor;
            let currentFile;
            if (editor && editor.document && editor.document.uri) {
                if (editor.document.uri.scheme !== 'untitled') {
                    currentFile = editor.document.uri.fsPath;
                }
            }

            if ((key.indexOf('${fileName}') >= 0 || key.indexOf('${fileExt}') >= 0)) {
                if (!currentFile) {
                    vscode.window.showWarningMessage('Please save this file...');
                    return resolve();
                }
                let fileName = path.basename(currentFile)
                    .substring(0, path.basename(currentFile).lastIndexOf('.'));
                let fileExt = path.extname(currentFile).substr(1);
                key = key
                    .replace(/\${fileName}/g, fileName)
                    .replace(/\${fileExt}/g, fileExt);
            }

            let date = new Date();
            let year = date.getFullYear();
            let month = (date.getMonth() < 9 ? '0' : '') + (date.getMonth() + 1);
            let day = (date.getDate() < 9 ? '0' : '') + date.getDate();
            let hour = (date.getHours() < 9 ? '0' : '') + date.getHours();
            let minute = (date.getMinutes() < 9 ? '0' : '') + date.getMinutes();
            let second = (date.getSeconds() < 9 ? '0' : '') + date.getSeconds();
            let time = date.getTime();

            key = key
                .replace(/\$\{year\}/g, year + '')
                .replace(/\$\{month\}/g, month)
                .replace(/\$\{day\}/g, day)
                .replace(/\$\{hour\}/g, hour)
                .replace(/\$\{minute\}/g, minute)
                .replace(/\$\{second\}/g, second)
                .replace(/\$\{time\}/g, time + '');

            if (key.indexOf('${input}') >= 0) {
                vscode.window.showInputBox({
                    value: this.lastNum,
                    prompt: 'Input value to cover ${input}'
                }).then((input) => {
                    this.lastNumChanged = this.lastNum != input;
                    if (!input) {
                        input = new Date().getMilliseconds() + '';
                    }
                    key = key.replace(/\$\{input\}/g, input);
                    resolve(key);
                });
            } else {
                resolve(key);
            }
        });
    }

    private isNoSettings(): boolean {
        if (this.config && this.config.isOk()) {
            return false;
        }
        vscode.window.showErrorMessage('Please set the AccessKey, SecretKey and BucketName first.',
            'Open Settings').then((item) => {
                if (item === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openGlobalSettings');
                }
            });
        return true;
    }

    dispose() {
        this.disposable.dispose();
        this.qiniu.dispose();
        this.qiniu = null;
    }

}
