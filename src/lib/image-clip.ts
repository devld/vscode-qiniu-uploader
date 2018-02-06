import { spawn } from 'child_process'
import * as path from 'path'

export function saveClipboardToFile(file: string): Thenable<Result> {
    return new Promise((resolve) => {
        if (!file) {
            return resolve({ success: false, error: 'File path must not be null' });
        }
        switch (process.platform) {
            case 'linux':
                linux(file, resolve);
                break;
            case 'win32':
                win(file, resolve);
                break;
            case 'darwin':
                mac(file, resolve);
                break;
            default:
                return resolve({ success: false, error: 'Sorry. Your system is not supported.' });
        }
    });
}

const COND_NO_IMAGE = 'no image';
const ERROR_UNKNOWN = 'Unknown error';
const ERROR_NO_IMAGE = 'No image in clipboard.';

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const SCRIPT_LINUX = path.join(SCRIPTS_DIR, 'linux.sh');
const SCRIPT_WIN = path.join(SCRIPTS_DIR, 'win.ps1');
const SCRIPT_MAC = path.join(SCRIPTS_DIR, 'mac.applescript');

function linux(file: string, resolve: (Result) => void) {
    execScript('sh', [SCRIPT_LINUX, file]).then((r) => {
        if (r.result == 'no xclip') {
            return resolve({ success: false, error: 'You need to install xclip command first.' });
        }
        if (r.result == COND_NO_IMAGE) {
            return resolve({ success: false, error: ERROR_NO_IMAGE });
        }
        if (r.code !== 0 || !r.result) {
            return resolve({ success: false, error: ERROR_UNKNOWN });
        }
        resolve({ success: true, file: r.result });
    });
}

function win(file: string, resolve: (Result) => void) {
    execScript('powershell', [
        '-noprofile',
        '-noninteractive',
        '-nologo',
        '-sta',
        '-executionpolicy', 'unrestricted',
        '-windowstyle', 'hidden',
        '-file', SCRIPT_WIN,
        file
    ]).then((r) => {
        if (r.result == COND_NO_IMAGE) {
            return resolve({ success: false, error: ERROR_NO_IMAGE });
        }
        if (!r.result || r.code !== 0) {
            return resolve({ success: false, error: ERROR_UNKNOWN });
        }
        resolve({ success: true, file: r.result });
    });
}

function mac(file: string, resolve: (Result) => void) {
    execScript('osascript', [SCRIPT_MAC, file]).then((r) => {
        if (r.result == COND_NO_IMAGE) {
            return resolve({ success: false, error: ERROR_NO_IMAGE });
        }
        if (!r.result || r.code !== 0) {
            return resolve({ success: false, error: ERROR_UNKNOWN });
        }
        resolve({ success: true, file: r.result });
    });
}

function execScript(host: string, args: string[]):
    Thenable<ScriptResult> {
    return new Promise((resolve) => {
        const sc = spawn(host, args);
        let result = '';
        sc.on('exit', (code, signal) => {
            console.log(code, signal, result);
            resolve({ code: code, signal: signal, result: result.trim() });
        });
        sc.stdout.on('data', (dat) => {
            result += dat.toString();
        });
    });
}

interface ScriptResult {
    code: number;
    signal: string;
    result: string;
}

interface Result {
    success: boolean;
    file?: string;
    error?: string;
}
