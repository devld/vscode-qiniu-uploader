'use strict';

import * as qiniu from 'qiniu';
import { Disposable } from 'vscode';

export class QiNiuUploader implements Disposable {

    private uploader: qiniu.form_up.FormUploader;
    private ak: string;
    private sk: string;
    private bucket: string;

    /**
     * @param ak access key
     * @param sk secret key
     * @param bucket bucket name
     */

    public constructor(ak: string, sk: string, bucket: string) {
        this.ak = ak;
        this.sk = sk;
        this.bucket = bucket;
        this.uploader = new qiniu.form_up.FormUploader();
    }

    public upload(key: string, file: string): Thenable<UploadResponse> {
        console.log(`upload: ${key}, ${file}`);
        return new Promise((resolve) => {
            let putExtra = new qiniu.form_up.PutExtra();
            this.uploader.putFile(this.makeUploadToken(), key, file, putExtra,
                (respErr, respBody, respInfo) => {
                    if (respErr) {
                        return resolve(new UploadResponse(false,
                            null, respErr.toString()));
                    }

                    let r = new UploadResponse(false, respInfo.statusCode, file);

                    switch (respInfo.statusCode) {
                        case 200:
                            r.success = true;
                            r.key = respInfo.data.key;
                            r.hash = respInfo.data.hash;
                            break;
                        case 614:
                            r.error = 'The file key already exists.'
                            break;
                        default:
                            r.error = 'Unknown upload error.';
                            break;
                    }
                    resolve(r);

                });
        });
    }

    private makeUploadToken(): string {
        let mac = new qiniu.auth.digest.Mac(this.ak, this.sk);
        let putPolicy = new qiniu.rs.PutPolicy({
            scope: this.bucket
        });
        return putPolicy.uploadToken(mac);
    }

    dispose() {
        this.uploader = null;
    }
}

export class UploadResponse {

    public constructor(success: boolean, statusCode: number,
        localFile: string, error?: string, key?: string, hash?: string) {
        this.success = success;
        this.statusCode = statusCode;
        this.localFile = localFile;
        this.error = error;
        this.key = key;
        this.hash = hash;
    }

    success: boolean;
    statusCode: number;
    localFile: string;
    key: string;
    hash: string;
    error: string;
}