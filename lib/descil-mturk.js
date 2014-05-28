/**
 * # descil-mturk connector
 * Copyright(c) 2014 Stefano Balietti
 * MIT Licensed
 *
 * Receives codes, performs checkIn, checkOut.
 * ---
 */

module.exports = descil;

var J = require('JSUS').JSUS,
NDDB = require('NDDB').NDDB,
request = require('request'),
winston = require('winston'),
path = require('path');

var conf_path = path.resolve(__dirname, '..', 'conf/descil.conf.js');

try {
    var conf = require(conf_path);
}
catch (e) {
    console.log('An error occurred while loading the configuration file: ' + conf_path);
    console.log('Make sure the file exists and it is readable');
    throw new Error(e);
}

var SERVICEKEY = conf.key;
var PROJECT = conf.project;
var DESCIL_URI = conf.uri;

if (!SERVICEKEY) {
    throw new Error('File ' + conf_path + ' does not contain any valid service key. Aborting');
}

if (!PROJECT) {
    throw new Error('File ' + conf_path + ' does not contain any valid project code. Aborting');
}

if (!DESCIL_URI) {
    throw new Error('File ' + conf_path + ' does not contain a valid uri for the DeScil Lab. Aborting');
}


function descil() {
    
    this.operations = [
	'HelloWorld',
	'GetRequest',
	'GetResponse',
	'CheckIn',
	'CheckOut',
	'GetCodes',
	'PostCodes',
	'GetPayoffs',
	'PostPayoffs',
    ];

    this.verbosity;

    var codes = new NDDB();
    
    codes.index('id', function(i) {
	return i.AccessCode; 
    });
    
    codes.on('insert', function(o) {
        o.disconnected = false;
        o.kickedOut = false;
    });

    this.codes = codes;

    this.getCodes = function(cb) {

	var body = {
       	    "Operation": "GetCodes",
       	    "ServiceKey": SERVICEKEY,
       	    "ProjectCode": PROJECT,
       	    "AccessCode":"",
       	    "ExitCode":"",
       	    "Bonus":0,
       	    "Payoffs":[],
       	    "Codes":[]
        };
       	
	request(
	    { method: 'POST'
	      , uri: DESCIL_URI
	      , json: body
	    }
	    , function(err, response, body) {
		if (err) {
		    winston.error(err);
		    winston.info('Response body', body);	
		}
		else {
		    winston.info('Response code', response.statusCode);
		    codes.importDB(body.Codes);
		    codes.rebuildIndexes();
		    winston.info('Codes', codes.fetchValues()); 
		}
		
		if (cb) cb(err, response, body);
	    }
	);
    };

    this.checkIn = function(accesscode, cb) {
        var code, body;
       	if (!accesscode) return;
       	
        body = {
       	    "Operation":"CheckIn",
       	    "ServiceKey": SERVICEKEY,
       	    "ProjectCode": PROJECT,
       	    "AccessCode": accesscode,
       	};  	

        request(
            { method: 'POST'
              , uri: DESCIL_URI
              , json: body
            }
            , function(err, response, body) {
         	if (err) {
         	    winston.error('Error: ' + err);
         	    winston.info('Response body', body);
       		}
       		else {
       	  	    winston.info('Response code', response.statusCode);
       	  	    winston.info('Response body', body);
       	  	    
         	}
         	if (cb) cb(err, response, body);
            }
        );
    };

    this.checkOut = function(accesscode, exitcode, bonus, cb) {
       	bonus = bonus || 0;
       	var body = {
            "Operation": "CheckOut",
            "ServiceKey": SERVICEKEY,
            "ProjectCode": PROJECT,
            "AccessCode": accesscode,
            "ExitCode": exitcode,
            "Bonus": bonus,
        };

        request(
            { method: 'POST'
              , uri: DESCIL_URI
              , json: body
            }
            , function(err, response, body) {
         	if (err) {
         	    winston.error('Error: ' + err);
         	    winston.info('Response body', body);  			  
       		}
       		else {
       	  	    winston.info('Response code', response.statusCode);
       	  	    winston.info('Response body', body);
         	}
         	if (cb) cb(err, response, body);
            }
        );
    };


    this.dropOut = function(accesscode, exitcode, bonus, cb) {
       	bonus = bonus || 0;
       	var body = {
            "Operation": "DropOut",
            "ServiceKey": SERVICEKEY,
            "ProjectCode": PROJECT,
            "AccessCode": accesscode,
        };

        request(
            { method: 'POST'
              , uri: DESCIL_URI
              , json: body
            }
            , function(err, response, body) {
         	if (err) {
         	    winston.error('Error: ' + err);
         	    winston.info('Response body', body);  			  
       		}
       		else {
       	  	    winston.info('Response code', response.statusCode);
       	  	    winston.info('Response body', body);
         	}
         	if (cb) cb(err, response, body);
            }
        );
    };


    this.postCodes = function(codes, cb) {
       	bonus = bonus || 0;
       	var body = {
            "Operation": "PostCodes",
            "ServiceKey": SERVICEKEY,
            "ProjectCode": PROJECT,
            "Codes": codes,
        };

        request(
            { method: 'POST'
              , uri: DESCIL_URI
              , json: body
            }
            , function(err, response, body) {
         	if (err) {
         	    winston.error('Error: ' + err);
         	    winston.info('Response body', body);  			  
       		}
       		else {
       	  	    winston.info('Response code', response.statusCode);
       	  	    winston.info('Response body', body);
         	}
         	if (cb) cb(err, response, body);
            }
        );
    };

    
    this.codeExists = function(accesscode) {
	if (!codes || !codes.length) {
	    winston.error('Empty code database');
	    return false;
	}
	if (!accesscode) return;
	
	if (!codes.id[accesscode]) {
	    winston.error('Non existing accesscode: ' + accesscode);
	    return false;
	}
	
	return true;
    }    
    
    
    this.markUsed = function(accesscode) {
	if (!this.codeExists(accesscode)) return false;
	
	codes.id[accesscode].used = true;
	return true;
    };
    
    this.markUnused = function(accesscode) {
	if (!this.codeExists(accesscode)) return false;
	
	codes.id[accesscode].used = false;
	return true;
    };
    
    this.isUsed = function(accesscode) {
	if (!this.codeExists(accesscode)) return false;
	
	return codes.id[accesscode].used;
    };

    this.incrementUsage = function(accesscode) {
	if (!this.codeExists(accesscode)) return false;
	
	if (!codes.id[accesscode].usage) {
	    codes.id[accesscode].usage = 1;
	}
	else {
	    codes.id[accesscode].usage++;
	}
	return true;
    };
    
    this.decrementUsage = function(accesscode) {
	if (!this.codeExists(accesscode)) return false;
	
	if (!codes.id[accesscode].usage) {
	    codes.id[accesscode].usage = 0;
	    winston.error('Negative usage of code: ' + accesscode);
	    return false;
	}
	else {
	    codes.id[accesscode].usage++;
	}
	return true;
    };
    
    this.codeUsage = function(accesscode) {
	if (!this.codeExists(accesscode)) return false;
	return codes.id[accesscode].usage || 0;
    };
}



/* ************************************************************************
   SINGLETON CLASS DEFINITION
   ************************************************************************ */
var dk = null;

function getInstance(){
    if (dk === null) {
	dk = new descil();
    }
    return dk;
}

module.exports = getInstance();

