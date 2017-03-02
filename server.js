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
    // '2015-09-20T18:38:51Z-nwq-1-a72b9cde9aba1fdf83fc800b3e260bb6e3bb7173-0.result
    
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
        readLogDir,
        wrapReturner(function presentResults(dirList) {
            var r = { month: getMonth(dirList[0]), integrations: [] };
            r.integrations = dirList.map(testMapper);
            return r;
        })
    ];

    async.waterfall(tasks, next);
}

(function testGetLogInvalid() {
    var expected = {};
    getLog('i-do-not-exist', function(err, result) {
        assert.equal(err.message, 'No test results found');
        assert(err instanceof Error404);
    });
})();

(function testGetLogNowAndDate() {
    var expected = {
        month: "2015-09",
        integrations: [
            { date: '2015-09-20T18:38:51Z', project: 'nwq', run: 1, result: 0,   id: 'a72b9cde9aba1fdf83fc800b3e260bb6e3bb7173' },
            { date: '2015-09-21T06:47:19Z', project: 'nwq', run: 2, result: 0,   id: '58f3365f00bce1a83d9c65aeb67fd70878cb5a7d' },
            { date: '2015-09-21T19:17:56Z', project: 'nwq', run: 3, result: 126, id: '0a2032da79dbd7226168a017f0e07e3b7c290da5' },
            { date: '2015-09-21T20:02:25Z', project: 'nwq', run: 4, result: 0,   id: 'eca10c0b47721e0a91d4d6185349c00ffa87cc0b' },
            { date: '2015-09-21T20:40:41Z', project: 'nwq', run: 5, result: 1,   id: '3db02ddb4416a8d68908341aadcc598a3741ca40' }
        ]
    };

    async.parallel(
        {
            'undefined': getLog.bind(null, undefined),
            '2015-09': getLog.bind(null, undefined),
            // 'does-not-exist': getLog.bind(null, undefined)
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
                return res.status(match[1]).json({ error: err.message});
            }
            res.json(results);
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
 
app.get('/', getFileServeFn('index.html'));
app.get('/index.html', getFileServeFn('index.html'));
app.get('/index.js', getFileServeFn('index.js'));

app.get('/api/', serve(getLog.bind(null, undefined)));
app.get('/api/:ym', function(req, res) {
    let handler = serve(getLog.bind(null, req.params.ym));
    handler(req, res);
});
 
if (process.argv[2] !== 'test') {
    app.listen(LISTEN_PORT);
}
