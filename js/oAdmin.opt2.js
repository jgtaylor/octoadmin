class Emitter {
	constructor() {
		var delegate = document.createDocumentFragment();
		[
			"addEventListener",
			"dispatchEvent",
			"removeEventListener"
		].forEach( f =>
			this[ f ] = ( ...xs ) => delegate[ f ]( ...xs )
		);
	}
}
class Device extends Emitter {
	constructor( device ) {
		super();
		this.device = device.device;
		this.deviceName = device.deviceName || "default";
		this.type = device.type;
		this.validCmds = device.validCmds;
	}
}
class DeviceManager extends Emitter {
	constructor( options ) {
		super();
		this._devices = [];
		this._conn = {};
		this.connectOptions = options;
		this.connect( this.connectOptions );
		this._connected = false;
	}
	connect( options ) {
		let self = this;
		self._conn = new WebSocket( options );
		self._conn.addEventListener( "message", function msgHandler( msg ) {
			self.router( msg );
		}, self );
		self._conn.addEventListener( "close", function closeHandler() {
			isConnected( false );
			window.setTimeout( () => {
				self.connect( self.connectOptions );
			}, 2000 );
		}, self );
		self._conn.addEventListener( "open", function openHandler() {
			isConnected( true );
			self._conn.send( self.packet( "load" ) );
		} );
	}
	packet( obj ) {
		// packet:  [ "client", string || { cmd: { device: string, detail: {object} }}]
		let _packet = [ "client" ];
		if ( typeof obj === "string" ) {
			_packet.push( {
				cmd: obj
			} );
		} else if ( typeof obj === "object" ) {
			_packet.push( obj );
		}
		return JSON.stringify( _packet );
	}
	router( msg ) {
		// [ route, {payload} ]
		msg = JSON.parse( msg.data );
		if ( !Array.isArray( msg ) ) {
			return new Error( "Invalid message format: %s", msg );
		}
		let route = msg[ 0 ],
			payload = msg[ 1 ];
		switch ( route ) {
		case "lm-device-add":
		case "device-add":
		{
			this.addDevice( payload );
			break;
		}
		case "lm-device-remove":
		case "device-remove":
		{
			this.removeDevice( payload );
			break;
		}
		case "lm-device-update":
		case "device-update":
		{
			this.updateDevice( payload );
			break;
		}
		case "message-device":
		{
			// used for getting readings or whatever passed from device to Admin.
			console.log( "Message received: %s", payload );
			break;
		}
		case "lm-update": // old keys
		case "load-devices":
		{
			document.getElementById( "devices" )
				.innerHTML = "";
			payload.devices.forEach( ( d ) => {
				this.addDevice( new Device( d ) );
			} );
			break;
		}
		}
	}
	get devices() {
		return this._devices;
	}
	device( device ) {
		return this._devices.find( ( i ) => {
			return i.device === device;
		} );
	}
	addDevice( device ) {
		if ( !this.device( device ) ) {
			this._devices.push( device );
			let _event = new CustomEvent( "device-add", {
				detail: device
			} );
			this.dispatchEvent( _event );
			return true;
		}
		console.log( `Device "${device.device}" already exists. Device IDs must be unique.` );
	}
	removeDevice( device ) {
		let d = this._devices.find( ( el ) => {
			if ( el.device === device ) {
				return el;
			}
		} );
		console.log( d, device );
		this._devices.splice( this._devices.indexOf( d ), 1 ) ? true : false;
		let _event = new CustomEvent( "device-remove", {
			detail: device
		} );
		this.dispatchEvent( _event );
	}
	updateDevice( device, sync ) {
		if ( !deviceManager.device( device.device ) ) {
			console.log( `Can't update a device that doesn't exist! Device: ${device.device}` );
			return false;
		}
		this.removeDevice( device.device );
		this.addDevice( device );
		if ( sync ) {
			// { cmd: "device-sync", _changed: {device} }
			this.send( this.packet( {
				cmd: "device-sync",
				_changed: device
			} ) );
		}
		// let _event = new CustomEvent( "device-update", {
		// 	detail: device
		// } );
		// this.dispatchEvent( _event );
	}
	send( msg ) {
		this._conn.send( ( msg ) );
	}
}

function deviceButtonHandler( e ) {
	// create the command packet
	deviceManager.send( deviceManager.packet( {
		cmd: "device-cmd",
		details: {
			device: e.target.dataset.device,
			validCmd: e.target.innerText
		}
	} ) );
	// [ "cmd", { "device": "828fbaa2-4f56-4cc5-99bf-57dcb5bd85f5", "cmd": "on" } ]
	// { cmd: "device-cmd", details: {device: device-guid, validCmd: 'on'} } --  DM expects, end devic
}

function inputHandler( e ) {
	console.log( e );

	function save() {
		// update the deviceName.., or whatever this input is sitting next to.
		e.target.previousSibling.style.display = "";
		e.target.style.display = "none";
		e.target.parentElement.previousSibling.firstChild.innerText = e.target.value;
		// do the JSON.parse trick to get a copy of the device, instead of the
		// actual device.d
		let device = JSON.parse( JSON.stringify( deviceManager.device( e.target.dataset.device ) ) );
		device.deviceName = e.target.value; // there's no real merge strategy.
		deviceManager.updateDevice( device, true );
	}
	if ( e.keyCode == 13 ) { // || e.type === "blur"
		save();
	} else if ( e.keyCode == 27 ) {
		// clear everything out, and cancel changes.
		e.target.value = e.target.parentElement.previousSibling.firstChild.innerText;
		e.target.previousSibling.style.display = "";
		e.target.style.display = "none";
	}
}

function editDetail( e ) {
	console.log( e );
	e.target.style.display = "none";
	e.target.nextSibling.style.display = "inline";
	e.target.nextSibling.addEventListener( "keyup", inputHandler );
	e.target.nextSibling.addEventListener( "blur", inputHandler );
	e.target.nextSibling.focus();
}
const deviceHTMLFactory = function ( device ) {
	// div deviceID
	let div = document.createElement( "div" ),
		buttonDiv = document.createElement( "div" );
	div.classList.add( "device" );
	div.setAttribute( "id", device.device );
	buttonDiv.classList.add( "btn-div" );
	div.innerHTML =
		`<div class="device-items"><span data-name="${device.deviceName}">${device.deviceName}</span></div>
		<div><button class="fa fa-pencil" type="button" data-edit="${device.device}"></button><input type="text" data-device="${device.device}" style="display: none;"></input></div>
		<div class="device-id">ID: ${device.device}</div>`;
	div.querySelector( `[data-edit="${device.device}"]` )
		.addEventListener( "click", editDetail );
	device.validCmds.forEach( ( cmd ) => {
		let _button = document.createElement( "button" );
		_button.setAttribute( "class", "btn" );
		_button.setAttribute( "data-device", device.device );
		_button.innerText = cmd;
		// _button.style.display = "inline-block";
		_button.addEventListener( "click", deviceButtonHandler );
		buttonDiv.appendChild( _button );
	} );
	div.appendChild( buttonDiv );
	return div;
};

function isConnected( conn ) {
	let connectIcon = document.getElementById( "websocket-connection" ),
		icon = document.getElementById( "ws-icon" );
	icon.classList.add( "fa" );
	connectIcon.appendChild( icon );
	if ( conn ) {
		connectIcon.style.backgroundColor = "green";
		icon.classList.remove( "fa-chain-broken" );
		icon.classList.add( "fa-link" );
		console.log( connectIcon );
	} else {
		connectIcon.style.backgroundColor = "red";
		icon.classList.remove( "fa-link" );
		icon.classList.add( "fa-chain-broken" );

	}
	console.log( icon.classList );
}

const deviceManager = new DeviceManager( "ws://localhost:2801/" );


deviceManager.addEventListener( "device-add", ( msg ) => {
	let deviceDiv = document.getElementById( "devices" );
	deviceDiv.appendChild( deviceHTMLFactory( msg.detail ) );
} );
deviceManager.addEventListener( "device-remove", ( msg ) => {
	console.log( msg.detail );
	let deviceDiv = document.getElementById( msg.detail );
	deviceDiv.remove();
} );
// deviceManager.addEventListener( "device-update", ( msg ) => {
// 	let deviceDiv = document.getElementById( msg.detail.device );
// 	deviceDiv = deviceHTMLFactory( msg.detail );
// } );