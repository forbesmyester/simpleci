var express = require('express'),
    fs = require('fs'),
    async = require('async'),
    assert = require('assert'),
    path = require('path');

var app = express();

const LISTEN_PORT = getEnvVar('LISTEN_PORT');
const SIMPLECI_CONFIG_LOG_DIR = getEnvVar('SIMPLECI_CONFIG_LOG_DIR');

class Error404 extends Error {
    constructor(m) {
        super(m);
    }
}

function getEnvVar(envVarName) {
    if (!process.env.hasOwnProperty(envVarName)) {
        throw new Error('You need to specify the environmental variable ' + envVarName);
    }
    return process.env[envVarName];
}

function wrapReturner(f) {
    return function(input, next) {
        var r = f(input);
        if (r instanceof Error) {
            return next(r);
        }
        next(null, r);
    }
}

function getExitStatusFromTestFilename(testFilename) {
    var m = testFilename.match(/(\d+)\.result$/);
    if (!m) { throw new Error500('Invalid test file found'); }
    return parseInt(m[1], 10);
}

function testMapper(testFilename) {
    
    var splitted = testFilename.split('-');
    return {
        id: splitted.slice(-2, -1).join('-'),
        run: splitted.slice(4, 5).pop(),
        project: splitted.slice(3, 4).pop(),
        date:  splitted.slice(0, 3).join('-'),
        result: parseInt(splitted.slice(-1), 10)
    };
    
}

function getMonth(testFilename) {
    return testFilename.split('-').slice(0, 2).join('-');
}

function readLogDir(dir, next) {
    let d = SIMPLECI_CONFIG_LOG_DIR;
    if (dir) {
        d = path.join(SIMPLECI_CONFIG_LOG_DIR, dir);
    }
    return fs.readdir(d, next)
}

function readLogFile(dir, filename, next) {
    var d = path.join(SIMPLECI_CONFIG_LOG_DIR, dir, filename);
    fs.readFile(d, { encoding: 'utf8' }, next);
}

function getLog(yearMonth, next) {

    var tasks = [
        readLogDir.bind(null, null),
        wrapReturner(function getSubDirToRead(dirs) {
            function f(dirName) {
                if (yearMonth === undefined) { return true; }
                return yearMonth == dirName;
            }


            var filteredDirs = dirs.filter(f);

            if (filteredDirs.length == 0) {
                return new Error404('No test results found');
            }

            return filteredDirs.sort().pop();
        }),
        readLogDir
    ];

    async.waterfall(tasks, next);
}

function presentLog(yearMonth, next) {
    getLog(yearMonth, function(err, log) {
        if (err) { return next(err); }
        var r = { month: getMonth(log[0]), integrations: [] };
        r.integrations = log.map(testMapper).reverse();
        return next(err, r);
    });
}

(function testGetLogInvalid() {
    var expected = {};
    presentLog('i-do-not-exist', function(err, result) {
        assert.equal(err.message, 'No test results found');
        assert(err instanceof Error404);
    });
})();

(function testGetLogNowAndDate() {
    var expected = {
        month: "2015-09",
        integrations: [
            { date: '2015-09-21T20:40:41Z', project: 'nwq', run: 5, result: 1,   id: '3db02ddb4416a8d68908341aadcc598a3741ca40' },
            { date: '2015-09-21T20:02:25Z', project: 'nwq', run: 4, result: 0,   id: 'eca10c0b47721e0a91d4d6185349c00ffa87cc0b' },
            { date: '2015-09-21T19:17:56Z', project: 'nwq', run: 3, result: 126, id: '0a2032da79dbd7226168a017f0e07e3b7c290da5' },
            { date: '2015-09-21T06:47:19Z', project: 'nwq', run: 2, result: 0,   id: '58f3365f00bce1a83d9c65aeb67fd70878cb5a7d' },
            { date: '2015-09-20T18:38:51Z', project: 'nwq', run: 1, result: 0,   id: 'a72b9cde9aba1fdf83fc800b3e260bb6e3bb7173' }
        ]
    };

    async.parallel(
        {
            'undefined': presentLog.bind(null, undefined),
            '2015-09': presentLog.bind(null, undefined),
        },
        function(err, results) {
            assert.equal(err, null);
            assert.deepEqual(results['undefined'], expected);
            assert.deepEqual(results['2015-09'], expected);
            // assert.deepEqual(results['does-not-exist'], {});
        }
    )
})();

function serve(f) {
    return function(req, res) {
        f(function(err, results) {
            var match;
            if (err) {
                if (match = err.constructor.name.match(/(\d+)$/)) {
                    return res.status(match[1]).json({ error: err.message});
                }
                console.log(err);
                return res.status(500).json({
                    error: getEnvVar('NODE_ENV') == 'development' ? err.message : 'Error'
                });
            }
            if (typeof results == 'string') {
                return res.send(results);
            }
            return res.json(results);
        });
    }
}

function getFileServeFn(filename) {
    return function(req, res) {
        fs.readFile(filename, { encoding: 'utf8' }, function(err, index) {
            res.send(index);
        });
    };
}

function presentTest(yearMonth, id, next) {
    getLog(yearMonth, function(err, log) {
        function filter(filename) {
            ob = testMapper(filename);
            if (id.match(/^[\d+]$/)) {
                return ob.run == id;
            }
            return ob.id == id;
        }

        var filteredResults = log.filter(filter);
        if (filteredResults.length == 0) {
            return next(new Error404('No test found'));
        }
        readLogFile(
            yearMonth,
            filteredResults[0]
        , next);
    });
}
 
app.get('/', getFileServeFn('index.html'));
app.get('/index.html', getFileServeFn('index.html'));
app.get('/index.js', getFileServeFn('index.js'));
app.get('/vue.js', getFileServeFn('vue.js'));
app.get('/node_modules/spectre.css/dist/spectre.css', getFileServeFn('node_modules/spectre.css/dist/spectre.css'));

app.get('/api/', serve(presentLog.bind(null, undefined)));
app.get('/api/:ym', function(req, res) {
    let handler = serve(presentLog.bind(null, req.params.ym));
    handler(req, res);
});
app.get('/api/:ym/:id', function(req, res) {
    var handler = serve(presentTest.bind(null, req.params.ym, req.params.id));
    handler(req, res);
});
 
if (process.argv[2] !== 'test') {
    app.listen(LISTEN_PORT);
}
