/*
    Proof of concept for front-end cache busting.
    Required:
      - cache.properties file
        i.e.
            css.cache = 0
            plugins.cache = 0
      - cache.json file (empty on first run, will error but be ok 2nd)
    Concept:
      - Monitor deploy folder for changes in files (JS, CSS).
      - If changes, update properties file.
      - Read in cache vars from prop file with Java i.e. main.1.min.css
      - Setup apache redirect to main.min.css
      - NOTE: Some CDNs ignore query string.
*/

module.exports = function(grunt) {

	grunt.registerTask('cache', 'Read and write to cache.properties file for cachebusting', function() {

        'use strict';

        // Variables used throughout
        var propFile = 'cache.properties',
            propObj = {},
            hashFile = 'cache.json',
            files = [
                {prop: 'css.cache', file: 'static/deploy/styles/site_78_direct.min.css'},
                {prop: 'plugins.cache', file: 'static/deploy/scripts/plugins.min.js'},
                {prop: 'tripadvisor.cache', file: 'static/deploy/scripts/tripadvisor.min.js'},
                {prop: 'main.cache', file: 'static/deploy/scripts/main.min.js'},
            ],
            updates = false,
            fs = require('fs'),
            crypto = require('crypto'),
            hashes = {},
            contents,
            parsed;

        // Check properties file exists
        if (!grunt.file.exists(propFile)) {
            grunt.log.error('Error. File ' + propFile + ' not found');
            return false;
        }

        // Read contents of file
        contents = grunt.file.read(propFile);

        // Convert properties to JSON for ease of updating
        parsed = contents.replace(/\\\r?\n\s*/g, '');
        parsed.split(/\r?\n/g).forEach(function (line) {
            var props,
                name,
                val;
            line = line.trim();
            // Ignore comments and split out values
            if (line && line.indexOf('#') !== 0 && line.indexOf('!') !== 0) {
                props = line.split(/\=(.+)?/);
                name = props[0] && props[0].trim();
                val = props[1] && props[1].trim();
                propObj[name] = val;
            }
        });

        // Read respective hashfile
        if (grunt.file.exists(hashFile)) {
            try {
                hashes = grunt.file.readJSON(hashFile);
            }
            catch (err) {
                grunt.log.warn(err);
            }
        }
        grunt.verbose.writeflags(hashes, 'Hashes');

        // Loop through files, set hash and check if changed
        files.forEach(function (f) {

            var md5 = crypto.createHash('md5');
            var path = f.file, prop = f.prop;
            var stats = fs.statSync(path);

            md5.update(JSON.stringify({
                filepath: path,
                isFile: stats.isFile(),
                size: stats.size,
                ctime: stats.ctime,
                mtime: stats.mtime
            }));

            var hash = md5.digest('hex');
            grunt.verbose.writeln('Hash: ' + hash);

            if (hash != hashes[path]) {
                grunt.log.writeln(path + ' changed, updating cache variable.');
                propObj[prop]++;
                hashes[path] = hash;
                updates = true;
            }

        });

        // If there are changes update variables
        if(updates) {

            // Update hashes for check next time
            grunt.file.write(hashFile, JSON.stringify(hashes));

            // Convert objects to string to update properties file
            var str = '';
            for (var prop in propObj) {
                str += prop +' = '+ propObj[prop] + '\n';
            }
            grunt.file.write(propFile, str);

        } else {

            grunt.log.writeln('No files have changed.');

        }


    });

};