module.exports = Descil;

var J = require('JSUS').JSUS,
	NDDB = require('NDDB'),
	request = require('request'),
	winston = require('winston'),
	path = require('path');

var conf_path = path.resolve('..', 'conf/descil.conf.js')

try {
	var conf = require(conf_path);
}
catch (e) {
	console.log('An error occurred while loading the configuration file: ' + conf_path);
	console.log('Make sure the file exists and it is readable');
	throws new Error(e);
}

var SERVICEKEY = conf.key;
var PROJECT = conf.project;

if (!SERVICEKEY) {
	throws new Error('File ' + conf_path + ' does not contain any valid service key. Aborting');
}

if (!PROJECT) {
	throws new Error('File ' + conf_path + ' does not contain any valid project code. Aborting');
}

var DESCIL_URI = 'https://www.descil.ethz.ch/apps/mturk2/api/service.ashx';

function Descil() {}


Descil.operations = [
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

Descil.verbosity;

var codes = new NDDB();

Descil.prototype.getCodes = function (cb) {
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
		  , function (err, response, body) {
			  if (err) {
				  winston.error(err);
				  if (cb) cb(null);
			  }
			  else {
				  winston.info('Response code: '+ response.statusCode);
			      codes.importDB(body.Codes);
			      winston.info(codes.fetchValues());
			      
			      if (cb) cb(body);  
			  }
			  
		  }
	);
};

Descil.prototype.checkOut = function (accesscode, exitcode, bonus, cb) {
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
  	  , function (error, response, body) {
  		  if (error) {
  			  winston.error('Error: ' + error);
  			  if (cb) cb(null);
		  }
		  else {
	  		  winston.info('Response code: '+ response.statusCode);
	  		  winston.info(body);
	  		  if (cb) cb(body);  
  	      }
  	  	}
    );
};


