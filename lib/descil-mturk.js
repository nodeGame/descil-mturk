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


function descil() {}


descil.operations = [
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

descil.verbosity;

descil.codes = new NDDB();

descil.getCodes = function (cb) {
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
	  			  winston.info('Response body', body);	
			  }
			  else {
				  winston.info('Response code', response.statusCode);
			      descil.codes.importDB(body.Codes);
			      winston.info('Codes', descil.codes.fetchValues()); 
			  }
			  
			  if (cb) cb(err, response, body);
		  }
	);
};

descil.checkIn = function (accesscode, cb) {
	if (!accesscode) return;
	
	var body = {
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
  	  , function (err, response, body) {
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

descil.checkOut = function (accesscode, exitcode, bonus, cb) {
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
  	  , function (err, response, body) {
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


descil.dropOut = function (accesscode, exitcode, bonus, cb) {
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
  	  , function (err, response, body) {
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


descil.postCodes = function (codes, cb) {
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
  	  , function (err, response, body) {
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

