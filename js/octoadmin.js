"use strict";
/* eslint no-unused-vars: "off", no-console: "off" */

const ws = new WebSocket( "ws://localhost:2801/" );

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
		this.deviceName = device.deviceName;
		this.type = device.type;
		this.validCmds = device.validCmds;
	}
}
class DeviceManager extends Emitter {
	constructor() {
		super();
		this.devices = [];
	}
	modelUpdate( m ) {
		this.devices = m.devices;
		let _event = new CustomEvent( "model-update", {
			detail: this.devices
		} );
		this.dispatchEvent( _event );
	}

	deviceAdd( d ) {
		let device = new Device( d );
		this.devices.push( device );
		let _event = new CustomEvent( "device-add", {
			detail: this.devices[ len ]
		} );
		this.dispatchEvent( _event );
	}

	deviceRemove( dID ) {
		let toRemove = this.devices.find( ( el ) => {
			return el.device === dID;
		} );

		let _cache = JSON.parse( JSON.stringify( toRemove ) );
		this.devices.splice( this.devices.indexOf( toRemove ), 1 );
		let _event = new CustomEvent( "device-remove", {
			detail: _cache.device
		} );
		this.dispatchEvent( _event );
	}
}

// packet("thing to bundle up for sending")
function packet( obj ) {
	let _packet = [ "client" ],
		payload = {};
	if ( typeof obj === "string" ) {
		payload = {
			cmd: obj
		};
	} else if ( typeof obj === "object" ) {
		payload = obj;
	}
	_packet.push( payload );
	return JSON.stringify( _packet );
}


// handle messags in the [ "lm-function-", { stuff } ]
function msgRouter( msg ) {
	let _msg = JSON.parse( msg.data );
	// should be an array
	if ( !Array.isArray( _msg ) ) {
		return new Error( "Recieved %s, expected an array.", _msg );
	}
	if ( _msg.length !== 2 ) {
		return new Error( "Invalid Packet size. Expected 2 elements, but recieved %s.", _msg.length );
	}
	// msg[0] can be: lm-update, lm-device-add, lm-device-remove ... more later.
	let payload = _msg[ 1 ];
	let route = _msg[ 0 ];
	// console.log("route: ", route);
	// console.log("payload", payload);
	switch ( route ) {
	case "lm-update":
	{
		dm.modelUpdate( payload );
		break;
	}
	case "lm-device-add":
	{
		dm.deviceAdd( payload );
		break;
	}
	case "lm-device-remove":
	{
		dm.deviceRemove( payload );
		break;
	}
	default:
	{
		break;
	}
	}
	return route, payload;
}



function getParentID( el ) {
	if ( el.id !== "" ) {
		return el;
	} else {
		el = getParentID( el.parentElement );
	}
	return el;
}

function ulGenerator( obj, k ) {
	// this is an awesome function, but it's horribly implemented.
	//create UL

	let _ul = document.createElement( "ul" );
	if ( k ) {
		_ul.setAttribute( "data-key", k );
		_ul.setAttribute( "class", "device-items" );
	}
	_ul.setAttribute( "class", "device-items" );
	let _cache = JSON.parse( JSON.stringify( obj ) );
	// _ul.setAttribute("id", _ourID);
	// if not object, otherwise call ourself on object.
	// iterate through object, creating LIs
	if ( typeof obj === "object" && Array.isArray( obj ) === false ) {
		Object.keys( obj )
			.forEach( ( key ) => {
				if ( typeof obj[ key ] !== "object" ) {
					let li = document.createElement( "li" );
					let label = document.createElement( "label" );
					let input = document.createElement( "input" );
					let span = document.createElement( "span" );
					// span.setAttribute("data-key", key);
					span.innerText = obj[ key ];
					label.innerText = `${key}: `;
					label.style.fontWeight = "bold";
					input.setAttribute( "placeholder", obj[ key ] );
					input.setAttribute( "type", "text" );
					k ? input.setAttribute( "data-key", k ) : null;
					input.style.display = "none";
					li.appendChild( label );
					li.appendChild( span );
					li.appendChild( input );

					span.addEventListener( "click", function ( e ) {
						// console.log(e);
						e.target.style.display = "none";
						input.style.display = "inline";
						span.nextSibling.focus();
						input.addEventListener( "keyup", function ( e ) {
							// console.log(e);
							if ( e.keyCode == 13 ) {
								let dIdx = getParentID( e.target.parentElement );
								// console.log(dIdx);
								span.innerText = e.target.value;
								input.style.display = "none";
								span.style.display = "inline";
								// figure out how to pass along the device: xxxx
								let device = dm.devices.find( ( d ) => {
									return d.device === dIdx.id;
								} );
								let i = dm.devices.indexOf( device );
								let targetKey = false;
								if ( e.target.hasAttribute( "data-key" ) ) {
									targetKey = e.target.getAttribute( "data-key" );
								}
								if ( targetKey ) {
									obj[ key ] = e.target.value;
									dm.devices[ i ][ targetKey ] = obj[ key ];
								} else {
									dm.devices[ i ][ obj[ key ] ] = e.target.value;
								}
							}
						} );
						input.addEventListener( "keyup", function ( e ) {
							// console.log(e);
							if ( e.keyCode == 27 ) {
								// return shit to normal and cancel edit.
								span.innerText = _cache[ key ];
								input.style.display = "none";
								span.style.display = "inline";
							}
						} );
					} );
					//apend LIs to UL
					_ul.appendChild( li );
				} else {
					if ( key === "meta" ) {
						console.log( "Ignoring meta properties." );
						return;
					}
					let li = document.createElement( "li" );
					li.innerHTML = `<span style="font-weight: bold;" data-key=${key}>${key}: </span>`;
					li.appendChild( ulGenerator( obj[ key ], key ) );
					_ul.appendChild( li );
				}
			} );
	} else if ( Array.isArray( obj ) ) {
		obj.forEach( ( el, i ) => {
			if ( typeof el !== "object" ) {
				let li = document.createElement( "li" );
				let button = document.createElement( "button" );
				button.innerText = `${el}`;
				button.setAttribute( "class", "btn" );
				li.setAttribute( "class", "device-cmds" );
				// add handler to send packet with comand.
				button.addEventListener( "click", function ( e ) {
					// get device, build packet, ship it off.
					let device = getParentID( e.target.parentElement )
						.id;
					// { cmd: "device-cmd", details: {device: device-guid, validCmd: 'on'} }
					let toSend = packet( {
						cmd: "device-cmd",
						details: {
							device: device,
							validCmd: e.target.innerText
						}
					} );
					console.log( toSend );
					ws.send( toSend );
				} );
				li.appendChild( button );
				//apend LIs to UL
				_ul.appendChild( li );
			} else {
				let li = document.createElement( "li" );
				li.innerText = `${i}:`;

				li.appendChild( ulGenerator( el ) );
				_ul.appendChild( li );
			}
		} );
	}
	return _ul;
	// return UL
}

var dm = new DeviceManager();

ws.addEventListener( "message", msgRouter );
ws.addEventListener( "open", () => {
	ws.send( packet( "load" ) );
} );
dm.addEventListener( "model-update", () => {
	// render stuff to the page using dm.devices ...
	let el = document.getElementById( "devices" );
	dm.devices.forEach( ( d ) => {
		let child = ulGenerator( d );
		child.style.border = "solid black 1px";
		child.setAttribute( "id", d.device );
		child.setAttribute( "class", "device" );
		el.appendChild( child );
	} );
} );
dm.addEventListener( "device-add", ( m ) => {
	// render stuff to the page using dm.devices ...
	let el = document.getElementById( "devices" );
	let child = ulGenerator( m.detail );
	child.setAttribute( "id", m.detail.device );
	child.setAttribute( "class", "device" );
	el.appendChild( child );
} );
dm.addEventListener( "device-remove", ( m ) => {
	let el = document.getElementById( m.detail );
	el.remove();
} );