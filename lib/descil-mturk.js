/**
 * # Descil-MTurk
 * Copyright(c) 2013 Stefano Balietti
 * MIT Licensed
 *
 * Javascript API to communicate with the Descil server for handling
 * turkers authentication.
 *
 * The class is exported as a singleton, so all instances will share the same
 * codes database.
 *
 * http://www.descil.ethz.ch/
 * ---
 */

var J = require('JSUS').JSUS,
NDDB = require('NDDB').NDDB,
request = require('request'),
winston = require('winston'),
path = require('path');

function descil() {
    
    var SERVICEKEY, PROJECT, DESCIL_URI;
    var codes;

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

    codes = new NDDB();
    
    codes.index('id', function(i) {
	return i.AccessCode; 
    });
    
    this.codes = codes;

    this.readConfiguration = function(confPath) {

        try {
            var conf = require(confPath);
        }
        catch(e) {
            console.log('descil-mturk: Could not load configuration file: ' +
                        confPath);
            throw new Error(e);
        }

        SERVICEKEY = conf.key;
        PROJECT = conf.project;
        DESCIL_URI = conf.uri;

        if (!SERVICEKEY) {
            throw new Error('descil-mturk: no service key found in ' + confPath);
        }

        if (!PROJECT) {
            throw new Error('descil-mturk: no project code found in '
                            + confPath);
        }

        if (!DESCIL_URI) {
            throw new Error('descil-mturk: no service uri found in ' + confPath);
        }
    };


    /**
     * ## getConfiguration
     *
     * Returns current configuration variables
     *
     * Variables are _SERVICEKEY_, _PROJECT_, and _DESCIL_URI_.
     *
     * @return {object}
     */
    this.getConfiguration = function() {
        return {
            SERVICEKEY: SERVICEKEY,
            PROJECT: PROJECT,
            DESCIL_URI: DESCIL_URI
        };
    };
    /**
     * ## getCodes
     *
     * Asyncronously fetches available codes from Descil remote service
     *
     * Requests are specific to SERVICEKEY AND PROJECT.
     *
     * Codes are inserteed in the internal code database.
     *
     * @param {function} cb Optional. A callback to be executed when the codes
     *   have been loaded.
     *
     * @see NDDB.importDB
     * @see request
     */
    this.getCodes = function(cb) {
        var body;
	
        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil.getCodes: cb must be function or ' +
                                'undefined');
        }

        body = {
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
                debugger
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

    /**
     * ## checkIn
     *
     * Asyncronously validates an accesscode
     *
     * Requests are specific to SERVICEKEY AND PROJECT and accesscode.
     *
     * @param {string} accesscode The code to validate
     * @param {function} cb Optional. A callback to be executed when the codes
     *   have been loaded.
     *
     * @see checkOut
     * @see request
     */
    this.checkIn = function(accesscode, cb) {
        var body;
        if ('string' !== typeof accesscode) {
            throw new TypeError('descil.checkIn: accesscode must be string.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil.checkIn: cb must be function or ' +
                                'undefined');
        }            
        
       	body = {
       	    "Operation":"CheckIn",
       	    "ServiceKey": SERVICEKEY,
       	    "ProjectCode": PROJECT,
       	    "AccessCode": accesscode,
       	};  	

        request(
            { method: 'POST',
              uri: DESCIL_URI,
              json: body
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

    /**
     * ## checkOut
     *
     * Asynchrounously marks a player as checked-out, and optionally assigns a bonus
     *
     * When finishing a task each turker must receive an exit code.
     * The unique pair (accesscode; exitcode) is then checked out.
     *
     * @param {string} accesscode The entry code to check out
     * @param {string} exitcode The exit code to check out
     * @param {number} bonus Optional. A bonus to pay to the turker. Defaults, 0
     * @param {function} cb Optional. A callback to be executed with the
     *   results of the request
     *
     * @see checkOut
     * @see request
     */
    this.checkOut = function(accesscode, exitcode, bonus, cb) {
        var body;

        if ('string' !== typeof accesscode) {
            throw new TypeError('descil.checkOut: accesscode must be string.');
        }

        if ('string' !== typeof exitcode) {
            throw new TypeError('descil.checkOut: exitcode must be string.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil.checkOut: cb must be function or ' +
                                'undefined');
        }            

       	bonus = bonus || 0;

       	body = {
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

    /**
     * ## dropOut
     *
     * Asynchrounously marks a player as droped-out, and optionally assigns a bonus
     *
     * Even without finishing a task each turker must receive an exit code.
     * The unique pair (accesscode; exitcode) is then marked as dropped out.
     *
     * @param {string} accesscode The entry code to mark as dropped out
     * @param {string} exitcode The exit code to mark as dropped out
     * @param {number} bonus Optional. A bonus to pay to the turker. Defaults, 0
     * @param {function} cb Optional. A callback to be executed with the
     *   results of the request
     *
     * @see checkOut
     * @see request
     */
    this.dropOut = function(accesscode, exitcode, bonus, cb) {
        var body;

        if ('string' !== typeof accesscode) {
            throw new TypeError('descil.dropOut: accesscode must be string.');
        }

        if ('string' !== typeof exitcode) {
            throw new TypeError('descil.dropOut: exitcode must be string.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil.dropOut: cb must be function or ' +
                                'undefined');
        }      
       	bonus = bonus || 0;
       	
        body = {
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

    /**
     * ## postCodes
     *
     * Asynchrounously posts all exit codes with bonuns
     *
     * @param {array} Array of checkOut / dropOut objects
     * @param {function} cb Optional. A callback to be executed with the
     *   results of the request
     *
     * @see checkOut
     * @see request
     */
    this.postCodes = function(codes, cb) {
        var body;

        if ('object' !== typeof codes) {
            throw new TypeError('descil.postCodes: codes must be object.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil.postCodes: cb must be function or ' +
                                'undefined');
        }      

       	bonus = bonus || 0;

       	body = {
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

    /**
     * ## codeExists
     *
     * Checks if a code exists in the local database
     *
     *
     * @param {string} accesscode The entry code to verify
     * @return {object|boolean} the object with specified accesscode, or FALSE
     *   if the code is not found
     */
    this.codeExists = function(accesscode) {
        var obj;

	if ('string' !== typeof accesscode) {
            throw new TypeError('descil.codeExists: accesscode must be string.');
        }

        if (!codes || !codes.size()) {
	    winston.error('descil.codeExists: empty code database.');
	    return false;
	}
        obj = codes.id.get(accesscode);
	return obj || false;
    };
    
    /**
     * ## markUsed
     *
     * Marks a code as _used_ in the local database
     *
     * @param {string} accesscode The entry code to mark as dropped out
     * @return {object} obj The updated object with the given accesscode
     *
     * @see codeExists
     * @see markUnused
     * @see isUsed
     */
    this.markUsed = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.markUsed: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        obj.used = true;
        return obj;
    };

    /**
     * ## markUnused
     *
     * Marks a code as _unused_ in the local database
     *
     * @param {string} accesscode The entry code to mark as unused
     * @return {object} obj The updated object with the given accesscode
     *
     * @see codeExists
     */
    this.markUnused = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.markUnused: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        obj.used = true;
        return obj;
    };

    /**
     * ## isUsed
     *
     * Returns TRUE if a code is marked as _used_ in the local database
     *
     * @param {string} accesscode The entry code to check
     * @return {boolean} TRUE, if the code is used.
     *
     * @see codeExists
     */
    this.isUsed = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.isUsed: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        return obj.used;
    };

    /**
     * ## incrementUsage
     *
     * Increments by 1 the property _usage_ of the object in the local database
     *
     * @param {string} accesscode The entry code of the object to increment
     * @return {object} obj The updated object with the given accesscode
     *
     * @see decrementUsage
     * @see codeExists
     */
    this.incrementUsage = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.incrementUsage: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        obj.usage = obj.usage ? obj.usage++ : 1;
	return obj;
    };
    
     /**
     * ## incrementUsage
     *
     * Decrements by 1 the property _usage_ of the object in the local database
     *
     * Negative values for _usage_ are not allowed an error will be thrown
     *
     * @param {string} accesscode The entry code of the object to decrement
     * @return {object} obj The updated object with the given accesscode
     *
     * @see incrementUsage
     * @see codeExists
     */
    this.decrementUsage = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.decrementUsage: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
	if (!obj.usage) {
            throw new Error('descil.decrementUsage: usage cannot be negative. ' + 
                            'Accesscode: ' + accesscode);
	}
        obj.usage--;
	return obj;
    };
}



/* ************************************************************************
   SINGLETON CLASS DEFINITION
   ************************************************************************ */
var dk = null;

module.exports = function(confPath) {
    if (dk === null) {
	dk = new descil();
    }
    console.log('AA', confPath);
    confPath = 'undefined' !== typeof confPath ? confPath : 
        path.resolve(__dirname, '..', 'descil.conf.js')

    // Loading the configuration file
    dk.readConfiguration(confPath);
    
    return dk;
};

