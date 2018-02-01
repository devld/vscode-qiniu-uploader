import { WorkspaceConfiguration } from 'vscode';

export class Config {

    ak: string;
    sk: string;
    bucket: string;
    fileKeyPattern: string;
    domain: string;
    saveToLocal: boolean;
    localPath: string;

    public constructor(conf: WorkspaceConfiguration) {
        if (conf) {
            for (let i in conf) {
                if (typeof (conf[i]) !== 'function') {
                    this[i] = conf[i];
                }
            }
        }
    }

    public isOk(): boolean {
        if (!(this.ak && this.ak.length > 0 &&
            this.sk && this.sk.length > 0 &&
            this.bucket && this.bucket.length > 0 &&
            this.domain && this.domain.length > 0 &&
            this.fileKeyPattern && this.fileKeyPattern.length > 0)) {
            return false;
        }
        if (this.saveToLocal) {
            if (!(this.localPath && this.localPath.length > 0)) {
                return false;
            }
        }
        return true;
    }

}