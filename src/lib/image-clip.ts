import { spawn } from 'child_process'
import * as path from 'path'

export function saveClipboardToFile(file: string): Thenable<Result> {
    return new Promise((resolve) => {
        if (!file) {
            return resolve(new Result(false, 'File path must not be null'));
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
                return new Result(false, 'Sorry. Your system is not supported.');
        }
    });
}

const COND_NO_IMAGE = 'no image';
const ERROR_NO_IMAGE = 'No image in clipboard.';

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');

function linux(file: string, resolve: (Result) => void) {
    let scriptPath = path.join(SCRIPTS_DIR, 'linux.sh');
    let sh = spawn('sh', [scriptPath, file]);
    let result: string = '';
    sh.on('exit', (code, signal) => {
        result = result.trim();
        if (result == 'no xclip') {
            return resolve(new Result(false, 'You need to install xclip command first.'));
        }
        if (result == COND_NO_IMAGE) {
            return resolve(new Result(false, ERROR_NO_IMAGE));
        }
        resolve(new Result(true, null, result));
    });
    sh.stdout.on('data', (data) => {
        result += data.toString();
    });
}

function win(file: string, resolve: (Result) => void) {
    const scriptPath = path.join(SCRIPTS_DIR, 'win.ps1');
    const powershell = spawn('powershell', [
        '-noprofile',
        '-noninteractive',
        '-nologo',
        '-sta',
        '-executionpolicy', 'unrestricted',
        '-windowstyle', 'hidden',
        '-file', scriptPath,
        file
    ]);
    let result: string = '';
    powershell.on('exit', (code, signal) => {
        result = result.trim();
        if (result == COND_NO_IMAGE) {
            return resolve(new Result(false, ERROR_NO_IMAGE));
        }
        resolve(new Result(true, null, result));
    });
    powershell.stdout.on('data', (data) => {
        result += data.toString();
    });
}

function mac(file: string, resolve: (Result) => void) {
    let scriptPath = path.join(SCRIPTS_DIR, 'mac.applescript');
    let ascript = spawn('osascript', [scriptPath, file]);
    let result: string = '';
    ascript.on('exit', (code, signal) => {
        result = result.trim();
        if (!result) {
            return resolve(new Result(false, 'Unknown error.'));
        }
        if (result == COND_NO_IMAGE) {
            return resolve(new Result(false, ERROR_NO_IMAGE));
        }
        resolve(new Result(true, null, result));
    });
    ascript.stdout.on('data', (data) => {
        result += data.toString();
    });
}

class Result {

    public constructor(success: boolean, error?: string, file?: string) {
        this.success = success;
        this.file = file;
        this.error = error;
    }

    success: boolean;
    file: string;
    error: string;
}
