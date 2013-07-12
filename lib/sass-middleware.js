(function () {
    "use strict";
    var fs = require('fs'),
        url = require('url'),
        spawn = require('child_process').spawn;

    var updating = {};

    module.exports = function (options) {
        options = options || {};
        options.bin = options.bin || 'sass';
        options.src = options.src || 'public';
        options.dest = options.dest || options.src;
        options.quiet = options.quiet || false;
        options.cache_location = options.cache_location || false;

        var log = function (key, val, type) {
            var c;
            if (!options.quiet || type === 'error') {
                switch (type) {
                    case 'log':
                    case 'info':
                        c = '36m';
                        break;
                    case 'error':
                        c = '31m';
                        break;
                    case 'warn':
                        c = '33m';
                        break;
                    default:
                        type = 'log';
                }

                console[type]('  \x1b[90m%s :\x1b[0m \x1b['+c+'%s\x1b[0m', key, val);
            }
        };

        var sassError = function (str) {
            log("Sass", str, 'error');
        };
        var sassLog = function (str) {
            log("Sass", str, 'log');
        };


        var update = function (src, dest, cb) {
            var cmd = options.bin;
            var args = [];
            var opts = {
                cwd: process.cwd()
            };

            if (options.quiet) args.push('-q');
            if (options.cache_location) {
                args.push('--cache_location');
                args.push(options.cache_location);
            }
            args.push('--update');
            args.push(src + ':' + dest);

            var sass = spawn(cmd, args, opts);
            sassLog('Spawning `' + cmd + ' ' + args.join(' ') + '` in ' + opts.cwd);
            sass.stdout.on('data', function (data) {
                console.log('get stdout');
                data.toString().split('\n').forEach(sassLog);
            });
            sass.stderr.on('data', function (data) {
                console.log('get stderr');
                data.toString().split('\n').forEach(sassError);
            });
            sass.on('error', function (error) {
                cb(error);
            });
            sass.on('exit', function (code, signal) {
                if (code !== 0) {
                    sassError('exit with code '+code+' by signal '+signal+' (src: '+src+')');
                } else {
                    sassLog('exit with code '+code+' by signal '+signal);
                }
                cb();
            });
        };

        return function mw(req, res, next) {
            if ('GET' != req.method.toUpperCase() &&
                'HEAD' != req.method.toUpperCase())
            {
                return next();
            }

            var pathname = url.parse(req.url).pathname;

            if (! (/\.css$/).test(pathname)) {
                return next();
            }

            if (!(pathname in updating)) {
                updating[pathname] = true;
                var scss_exists = fs.existsSync(options.src + '/' + pathname.replace('.css', '.scss'));
                var sass_exists = fs.existsSync(options.src + '/' + pathname.replace('.css', '.sass'));
                if (!scss_exists && !sass_exists) {
                    return next();
                } else {
                    var ext = scss_exists ? '.scss' : '.sass';
                    var src = options.src + '/' + pathname.replace('.css', ext);
                    var dst = options.dest + '/' + pathname;
                    update(src, dst, function (error) {
                        if (error) {
                            sassError(error.message);
                        }
                        next();
                        delete updating[pathname];
                    });
                }
            } else {
                return setTimeout(mw.bind(this, req, res, next), 200);
            }
        };
    };
})();