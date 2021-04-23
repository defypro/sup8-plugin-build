#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const archiver = require('archiver');
const chalk = require('chalk');
const resolve = (dir, d = process.cwd()) => path.join(d, dir);

const CONFIG_PATH = resolve('./BuildConfig.json');

const configJSON = fs.readFileSync(CONFIG_PATH);

const configObj = JSON.parse(configJSON);

//检查执行目录是否有 BundleMetadata.xml
if (!exists(resolve("BundleMetadata.xml"))) {
    return console.log('请创建BundleMetadata.xml');
}

//创建发布文件夹
if (configObj.publishPath) {
    const publishPath = resolve(configObj.publishPath);
    if (fs.existsSync(publishPath)) {
        delDirSync(publishPath);
    }
    mkdirsSync(publishPath);
    copy(resolve("BundleMetadata.xml"), publishPath + "/BundleMetadata.xml");
} else {
    return console.log('缺少配置publishPath');
}

const releasePackageList = configObj.releasePackageList;
let bundleZipCount = 0;
releasePackageList.forEach(item => {
    if (!item.bundleName) return;
    if (!item.releasePath) return;
    if (!item.releaseList) return;

    const bundlePath = resolve(configObj.publishPath + '/' + item.bundleName);
    !fs.existsSync(bundlePath) && fs.mkdirSync(bundlePath);

    const releasePath = resolve(item.releasePath);
    if (!fs.existsSync(releasePath)) return;

    item.releaseList.forEach(file => {
        const src = releasePath + '/' + file;
        const dest = bundlePath + '/' + file;
        copy(src, dest);
    });

    item.otherFilePath.forEach(file => {
        let dest = bundlePath;
        if (file.lastIndexOf("/") > -1) {
            dest += file.substring(file.lastIndexOf("/"))
        };
        copy(resolve(file), dest);
    });


    zip(bundlePath, bundlePath, item.bundleName, function () {
        bundleZipCount++;
        if (bundleZipCount == releasePackageList.length) {
            const publishPath = resolve(configObj.publishPath);
            zipPlugin(publishPath, publishPath, configObj.pluginBudleName);
        }
    });

});

function zipPlugin(src, dest, name) {
    zip(src, dest, name);
    console.log("打包完成");
}

function zip(src, dest, name, callback) {
    const zipPathLast = `${dest}/../${name}.zip`;
    const zipPath = `${dest}/${name}.zip`;
    const output = fs.createWriteStream(zipPathLast);
    const archive = archiver('zip');
    output.on('close', function () {
        fs.renameSync(zipPathLast, zipPath);
        if (callback) callback();
    });
    archive.pipe(output);
    archive.directory(src, false);
    archive.finalize();
}

function exists(path) {
    return fs.existsSync(path);
}

function isFile(path) {
    return exists(path) && fs.statSync(path).isFile();
}

function isDir(path) {
    return exists(path) && fs.statSync(path).isDirectory();
}

function copy(src, dest) {
    if (isFile(src)) {
        copyFile(src, dest);
    } else if (isDir(src)) {
        copyDir(src, dest);
    }
}

function copyFile(src, dest) {
    if (dest.lastIndexOf("/") > -1) mkdirsSync(dest.substring(0, dest.lastIndexOf("/")));
    fs.writeFileSync(dest, fs.readFileSync(src));
}

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    const paths = fs.readdirSync(src);
    paths.forEach(p => {
        const _src = src + '/' + p;
        const _dest = dest + '/' + p;
        if (isFile(_src)) {
            copyFile(_src, _dest);
        } else if (isDir(_src)) {
            copyDir(_src, _dest);
        }
    });
}

function mkdirsSync(dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            //console.log("mkdirsSync = " + dirname);
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

function delDirSync(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (isDir(curPath)) { // recurse
                delDirSync(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};