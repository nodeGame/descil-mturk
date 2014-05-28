/**
 * # Descil-MTurk
 * Copyright(c) 2014 Stefano Balietti
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
fs = require('fs'),
path = require('path');

function descil() {

    "use strict";
    
    var SERVICEKEY, PROJECT, DESCIL_URI, LOCAL_FILE;
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

    codes = new NDDB( { update: { indexes: true } } );
    
    // Index by accesscode.
    codes.index('id', function(i) {
	return i.AccessCode; 
    });
    
    // Index by client id.
    codes.index('cid', function(i) {
	return i.clientId; 
    });
    
    this.codes = codes;

    // TRUE, if request has been made, and we are waiting for a reply.
    this.fetchingCodes = false;

    // Array of callbacks to be executed when the codes are received.
    this.onCodesReceived = [];

    // Executes and clear an array of callbacks.
    this.executesCodesReceivedCbs = function(remote, err, response, body) {
        var i, cb, len;
        i = -1, len = this.onCodesReceived.length;
        for (; ++i < len;) {
            cb = this.onCodesReceived[i];
            cb(remote, err, response, body);
        }
        this.onCodesReceived = [];
    }

    /**
     * ## readConfiguration
     *
     * Reads the configuration from file system
     *
     * Conf file are regular JS files with an export statement.
     *
     * @param {string} confPath The path to the configuration file
     */
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
        LOCAL_FILE = conf.file;
        
        if ('string' !== typeof SERVICEKEY) {
            throw new Error('descil-mturk: no valid service key found in ' +
                            confPath);
        }

        if ('string' !== typeof PROJECT) {
            throw new Error('descil-mturk: no project code found in '
                            + confPath);
        }

        // Either the URI or the LOCAL_FILE must be found.
        if ('string' !== typeof DESCIL_URI && 'string' !== typeof LOCAL_FILE) {
            throw new Error('descil-mturk: no valid service uri and no local ' +
                            'file found in ' + confPath);
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
            DESCIL_URI: DESCIL_URI,
            LOCAL_FILE: LOCAL_FILE
        };
    };

    /**
     * ## readCodes
     *
     * Asyncrounosly reads the codes from file system.
     *
     * @param {string} filePath The path the codes file.
     * @param {function} Optional. A callback function to execute upon
     *   the completetion of the operation.
     */
    this.readCodes = function(cb) {
        var data, that;
        
        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil.getCodes: cb must be function or ' +
                                'undefined');
        }

        // If the codes have already been fetched just execute the callback.
        if (this.codes && this.codes.size()) {
            if (cb) cb(false);
            return;
        }
        else {
            // Queue the execution of the callback.
            this.onCodesReceived.push(cb);
        }
        
        // If the codes are being fetched, just wait. 
        if (this.fetchingCodes) {    
            return;
        }

        this.fetchingCodes = true;

        that = this;

        try {
            data = require(LOCAL_FILE);
        }
        catch(e) {
            winston.error('descil-mturk: Could not load codes from file: ' +
                        LOCAL_FILE);
            throw new Error(e);
        }
            
        winston.info('Codes file read succesfully.');
        codes.importDB(data);
        winston.info('Codes: ', codes.fetchValues());
    
            
        that.fetchingCodes = false;
        that.executesCodesReceivedCbs(true, null, null, data);
    };

    /**
     * ## getCodes
     *
     * Asyncronously fetches available codes from Descil remote service
     *
     * The retrieved codes are inserted in the internal code database.
     * Requests are specific to SERVICEKEY AND PROJECT.
     *
     * If the method is invoked, but the codes have been already fetched
     * and inserted in the database, no new request is made.
     *
     * The callback, if specified, is always executed with the following
     * parameters: 
     *
     * - a boolean flag specified if a new request has been made 
     * - err, response, body returned by the request (if made)
     *
     * @param {function} cb Optional. A callback to be executed when the codes
     *   have been loaded.
     *
     * @see NDDB.importDB
     * @see request
     */
    this.getCodes = function(cb) {
        var that, body;
        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil.getCodes: cb must be function or ' +
                                'undefined');
        }
        // If the codes have already been fetched just execute the callback.
        if (this.codes && this.codes.size()) {
            if (cb) cb(false);
            return;
        }
        else {
            // Queue the execution of the callback.
            this.onCodesReceived.push(cb);
        }
        
        // If the codes are being fetched, just wait. 
        if (this.fetchingCodes) {    
            return;
        }

        this.fetchingCodes = true;

        that = this;

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
		if (err) {
		    winston.error(err);
		    winston.info('Response body', body);	
		}
		else {
		    winston.info('Response code', response.statusCode);
		    codes.importDB(body.Codes);
		    winston.info('Codes: ', codes.fetchValues()); 
		}
                that.fetchingCodes = false;
                that.executesCodesReceivedCbs(true, err, response, body);
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
        
        // CheckIn locally.
        this.updateCode(accesscode, {
            checkedIn: true
        });

        // CheckIn remotely.
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

        // CheckIn locally.
        this.updateCode(accesscode, {
            checkedOut: true,
            bonus: bonus
        });

        // CheckOut remotely.
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
     * ## hasCheckedOut
     *
     * Returns TRUE if a code is marked as _checkedOut_ in the local database
     *
     * @param {string} accesscode The entry code to check
     * @return {boolean} TRUE, if the code has been checked out.
     *
     * @see hasCheckedIn
     * @see checkOut
     */
    this.hasCheckedOut = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.hasCheckedOut: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        return obj.checkedOut ? true : false;
    };

    /**
     * ## hasCheckedIn
     *
     * Returns TRUE if a code is marked as _checkedIn_ in the local database
     *
     * @param {string} accesscode The entry code to check
     * @return {boolean} TRUE, if the code has been checked in.
     *
     * @see hasCheckedOut
     * @see checkIn
     */
    this.hasCheckedIn = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.hasCheckedIn: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        return obj.checkedIn ? true : false;
    };


    /**
     * ## dropOut
     *
     * Asynchrounously marks a player as dropped-out, and optionally assigns a bonus
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
     * ## markInvalid
     *
     * Marks a code as _invalid_ in the local database
     *
     * @param {string} accesscode The entry code to mark as dropped out
     * @return {object} obj The updated object with the given accesscode
     *
     * @see codeExists
     * @see markUnused
     * @see isUsed
     */
    this.markInvalid = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.marInvalid: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        obj.valid = false;
        return obj;
    };

    /**
     * ## markValid
     *
     * Marks a code as _valid_ in the local database
     *
     * @param {string} accesscode The entry code to mark as unused
     * @return {object} obj The updated object with the given accesscode
     *
     * @see codeExists
     */
    this.markValid = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.markValid: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        obj.valid = true;
        return obj;
    };

    /**
     * ## isValid
     *
     * Returns TRUE if a code is marked as _used_ in the local database
     *
     * @param {string} accesscode The entry code to check
     * @return {boolean} TRUE, if the code is used.
     *
     * @see codeExists
     */
    this.isValid = function(accesscode) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.isValid: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
        return obj.valid;
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

    /**
     * ## updateCode
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
    this.updateCode = function(accesscode, update) {
        var obj;
        obj = this.codeExists(accesscode);
	if (!obj) {
            throw new Error('descil.updateCode: no object found with ' + 
                            'accesscode: ' + accesscode);
        }
	if ('object' !== typeof update) {
            throw new Error('descil.updateCode: update must be object. ' + 
                            'Accesscode: ' + accesscode);
	}
        return codes.id.update(accesscode, update);
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
    confPath = 'undefined' !== typeof confPath ? confPath : 
        path.resolve(__dirname, '..', 'descil.conf.js')

    // Loading the configuration file
    dk.readConfiguration(confPath);
    
    return dk;
};

