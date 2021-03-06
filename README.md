# DeSciL-mturk

API to connect to the Amazon Mechanical Service payment service
provided by the ETH Decision Science Laboratory (DeSciL).

The DeSciL Mturk service is still in beta. If you are interested in
testing the `descil-mturk` API, contact the lab manager to receive
valid credentials.


## Setup

Create a file called `descil.conf.js` containing the following lines:

```javascript
module.exports.key = "zyx";
module.exports.project = "xyx";
module.exports.uri = "http://xxx.xxx";
module.exports.file = "path/to/codes"; // optional
```

You can then import the configuration file:

```javascript
var dk = require('descil-mturk')('path/to/descil.conf.js');

// or

var dk = require('descil-mturk')();
dk.readConfiguration('path/to/descil.conf.js');
```

## Usage

```javascript
dk.checkIn(code, cb);
dk.checkOut(code, cb);
dk.postPayoffs(payoffs, cb);
dk.dryRun(false); // Actually establishes connections with the service.
```

Refer to the in-line documentation for more examples.

## Resources

 * http://www.descil.ethz.ch/
 * http://github.com/nodeGame/

## License

Copyright (C) 2014 Stefano Balietti

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



