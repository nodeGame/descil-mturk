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

    /**
     * ## DRY_MODE
     *
     * In DRY_MODE no actual connection to a server is made. Default, true.
     *
     * @see descil.dryMode
     */
    var DRY_MODE = true;

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
    
    /**
     * ## executeOp
     *
     * Asynchrounously communicate with DeScil server
     *
     * Executes one of the operations available with DeScil server.
     *
     * @param {array} Array of checkOut / dropOut objects
     * @param {function} cb Optional. A callback to be executed with the
     *   results of the request
     *
     * @see request
     */
    function executeOp(operation, payload, cb) {
        var body;

        // If in DRY_MODE does not actually send any request.
        if (DRY_MODE) return;

       	body = {
            "Operation": operation,
            "ServiceKey": SERVICEKEY,
            "ProjectCode": PROJECT,            
        };

        J.mixin(body, payload);

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
    }

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

        if ('string' !== typeof confPath) {
            throw new TypeError('descil-mturk.readConfiguration: ' +
                'confPath must be string.');
        }
        try {
            var conf = require(confPath);
        }
        catch(e) {
            throw new Error('descil-mturk: ' +
                'Cannot locate ' + confPath + '! \n' +
                'Provide ' + confPath + ' with the following content: \n' +
                'module.exports.key = \"YOUR_KEY_HERE\"; \n' +
                'module.exports.project = \"YOUR_PROJECT_NAME_HERE\"; \n' +
                'module.exports.uri = \"YOUR_AUTH_SERVER_HERE\"; \n' +
                'module.exports.file = __dirname + \'/\' + \'auth_codes.js\';');
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
     * ## readConfiguration
     *
     * Returns / Sets the DRY_MODE variable
     *
     * In DRY_MODE no actual connection to a server is made.
     *
     * @param {boolean} status Optional. If specified, sets the DRY_MODE on/off
     *
     * @return {boolean} DRY_MODE The current value of the DRY_MODE variable
     */
    this.dryMode = function(status) {
        if ('boolean' === typeof status) {
            DRY_MODE = status;
        }
        else if ('undefined' !== typeof status) {
            throw new TypeError('descil-mturk.dryMode: ' +
                                'status must be boolean or undefined.');
        }
        return DRY_MODE;
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
            throw new TypeError('descil-mturk.getCodes: cb must be function ' +
                                'or undefined.');
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
        
        payload = {
            "AccessCode": "",
       	    "ExitCode": "",
       	    "Bonus": 0,
       	    "Payoffs": [],
       	    "Codes": []
        };

        that = this;
        executeOp('getCodes', payload, function(err, response, body) {
            that.fetchingCodes = false;
            that.executesCodesReceivedCbs(true, err, response, body)
        });
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
        
        executeOp('checkIn', { 'AccessCode': accesscode }, cb);
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
        
        if ('string' !== typeof accesscode) {
            throw new TypeError('descil-mturk.checkOut: accesscode must be ' +
                                'string.');
        }

        if ('string' !== typeof exitcode) {
            throw new TypeError('descil-mturk.checkOut: exitcode must be ' +
                                'string.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil-mturk.checkOut: cb must be function ' +
                                'or undefined');
        }

        executeOp('checkOut', {           
            "AccessCode": accesscode,
            "ExitCode": exitcode,
            "Bonus": bonus
        }, cb);
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
    this.dropOut = function(accesscode, cb) { // This changed!
        if ('string' !== typeof accesscode) {
            throw new TypeError('descil-mturk.dropOut: accesscode must be ' +
                                'string.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil-mturk.dropOut: cb must be function or ' +
                                'undefined');
        }

        executeOp('DropOut', { 'AccessCode': accesscode }, cb);
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
        if ('object' !== typeof codes) {
            throw new TypeError('descil-mturk.postCodes: codes must be object.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil-mturk.postCodes: cb must be function ' +
                                'or undefined.');
        }

        executeOp('PostCodes', { 'Codes': codes }, cb);
    };

    /**
     * ## postPayoff
     *
     * Asynchrounously posts all payoffs collected by players
     *
     * The items inside the array of payoffs must have the following structure:
     *
     *    {
     *      "AccessCode": "ValidAccessCode1",
     *      "Bonus": 1.1,
     *      "BonusReason": "Good job"
     *    }
     * 
     * @param {array} Array of payoffs objects
     * @param {function} cb Optional. A callback to be executed with the
     *   results of the request
     *
     * @see checkOut
     * @see request
     */
    this.postPayoffs = function(payoffs, cb) {
        if (J.isArray(payoffs)) {
            throw new TypeError('descil-mturk.postPayoffs: payoffs must be ' +
                                'array.');
        }

        if (cb && 'function' !== typeof cb) {
            throw new TypeError('descil-mturk.postPayoffs: cb must be ' +
                                'function or undefined.');
        }

        executeOp('PostPayoffs', { 'Payoffs': payoffs }, cb);
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
            throw new Error('descil-mturk.hasCheckedOut: no object found with ' +
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
            throw new Error('descil-mturk.hasCheckedIn: no object found with ' +
                            'accesscode: ' + accesscode);
        }
        return obj.checkedIn ? true : false;
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

    if ('undefined' !== typeof confPath) {
        // Loading the configuration file
        dk.readConfiguration(confPath);
    }

    return dk;
};
