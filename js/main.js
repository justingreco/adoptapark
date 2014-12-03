var config = {
	shelters: {
		url: 'http://mapststarcsrv3/parksrest/v1/ws_geo_attributequery.php',
		table: 'parks.greenway_adopters'
	},
	adopt: {
		url: 'http://mapststarcsrv3/parksrest/v1/ws_greenway_adopt.php'
	},
	search: {
		url: 'http://maps.raleighnc.gov/arcgis/rest/services/Addresses/MapServer/0/query',
		field: 'ADDRESS',
		searchField: 'ADDRESSU'
	}
};
var map, greenMarker, redMarker, markers, paths, shelterName, selected, lastColor;
//map functions//
function SetMarkerSymbols () {
	greenMarker = L.icon({
		iconUrl: 'img/marker-icon-green.png',
		iconSize: [25,41]
	});
	redMarker = L.icon({
		iconUrl: 'img/marker-icon-red.png',
		iconSize: [25,41]
	});
}
function CreateMap () {
	map = L.map('map').setView([35.83, -78.6436],11);
        L.tileLayer('http://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png',{minZoom: 10, maxZoom: 16, attribution: 'Tiles courtesy of <a href="http://openstreetmap.se/" target="_blank">OpenStreetMap Sweden</a> &mdash; Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'}).addTo(map);
	/*L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom: 16, attribution: 'Esri, DeLorme, NAVTEQ'}).addTo(map);*/
	paths = L.layerGroup().addTo(map);
	markers = L.layerGroup().addTo(map);
	if (Modernizr.geolocation) {
        L.control.locate().addTo(map);
    }
}
//display shelters on map//

function FormatDate(input) {
    var splitDate = input.split('-'),
	dt = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);
    dt.setTime(dt.getTime() + dt.getTimezoneOffset() * 60 * 1000);
    return dt.toLocaleDateString();
}

function ShowCircles (point) {
	L.circle(point, 10,{color:'gray', fillColor:'gray', opacity:1, fillOpacity:1}).addTo(map);
}

function AddCirclesToPolyline(pl) {
	var lines = [];
	if (pl._layers) {
		lines.push(pl.getLayers()[0]);
		lines.push(pl.getLayers()[pl.getLayers().length - 1]);
	} else {
		lines.push(pl);
	}

	$.each(lines, function (i, line) {
		var latlngs = line.getLatLngs(),
			start = latlngs[0],
			end = latlngs[latlngs.length - 1];
		ShowCircles(start);
		ShowCircles(end);
	});
}

function GetShelters () {
	$.ajax({
		url: config.shelters.url,
		data: {
			table: config.shelters.table,
			fields: '*'
		},
		cache: false,
		success: function (data) {
			$.each(data, function (i, shelter) {
				var geom = $.parseJSON(shelter.center),
					icon = greenMarker;
				if (shelter.start) {
					icon = redMarker;
				}
				var marker = L.marker([geom.coordinates[1], geom.coordinates[0]], {icon:icon});
				markers.addLayer(marker);
				var linegeom = $.parseJSON(shelter.geom);
				/*var pl = L.polyline([], {color:'green'});
				$.each(linegeom.coordinates[0], function (i, coord) {
					pl.addLatLng(coord.reverse());
				});*/
				var latlngs = [];

				var pl = null;
				if (linegeom.coordinates.length > 1) {
					$.each(linegeom.coordinates, function (i, coord) {
						//pl.addLatLng(coord.reverse());
						var ll = [];
						$.each(coord, function (j, c) {
							ll.push(L.latLng(c[1], c[0]));
						});
						latlngs.push(ll);
					});

					pl = new L.MultiPolyline(latlngs, {color:'green', opacity: 0.80});
				} else {
					pl = L.polyline([], {color:'green', opacity: 0.80});
					$.each(linegeom.coordinates[0], function (i, coord) {
						pl.addLatLng(coord.reverse());
					});
				}



				AddCirclesToPolyline(pl);
				pl.on('click', function (e) {
					highlightPath(this);
				});

				marker.on('click', function (e) {
					paths.eachLayer(function (layer) {
						var lPopup = (layer._popupContent) ? layer._popupContent : layer._popup.getContent();
						if ($(lPopup).data('id') === $(marker.getPopup().getContent()).data('id')) {
							highlightPath(layer);
						}
					});
				});
				if (shelter.start) {
					pl.setStyle({color:'red', opacity: 0.80});

				}

				paths.addLayer(pl);
				if (!shelter.start) {
					marker.bindPopup('<div class="text-center" data-id="'+shelter.id+'"><h5>' + shelter.segment + "</h5><p class='lead'></p><button data-id='" + shelter.id + "' data-name='" + shelter.segment + "'  data-toggle='modal' data-target='#adopt-modal' class='btn btn-success'>Adopt Me</button></div>");
					pl.bindPopup('<div class="text-center" data-id="'+shelter.id+'"><h5>' + shelter.segment + "</h5><button data-id='" + shelter.id + "' data-name='" + shelter.segment + "'  data-toggle='modal' data-target='#adopt-modal' class='btn btn-success'>Adopt Me</button></div>");
				} else {
                    marker.bindPopup('<div class="text-center" data-id="'+shelter.id+'"><h5>' + shelter.segment + '</h5>Greenway has been adopted by <strong>' + shelter.display +'</strong> through <strong>' + FormatDate(shelter.expires) + '</strong>.</div>');
					pl.bindPopup('<div class="text-center" data-id="'+shelter.id+'"><h5>' + shelter.segment + '</h5>Greenway has been adopted by <strong>' + shelter.display +'</strong> through <strong>' + FormatDate(shelter.expires) + '</strong>.</div>');
				}
				marker.on('popupopen', popupOpen);
				pl.on('popupopen', popupOpen);
			});
		}
	});
}

function highlightPath (path) {
	if (selected) {
		$.each(selected, function (i, selection) {
			selection.setStyle({color:lastColor});
		});
		
	}
	selected = [];

	if (path._layers) {
		$.each(path.getLayers(), function (i, l) {
			selected.push(l);
			lastColor = l.options.color;
			l.setStyle({color:'yellow', opacity: 0.80});
		});
	} else {
		selected.push(path);
		lastColor = path.options.color;
		path.setStyle({color:'yellow', opacity: 0.80});
	}
}

function popupOpen () {
	var id = $("button", (this._popupContent) ? this._popupContent : this._popup.getContent()).data('id'),
		name = $("button", (this._popupContent) ? this._popupContent : this._popup.getContent()).data('name');
	shelterName = name;
	$('#inputId').val(id);
	$("#adopt-modal .modal-title").text("Adopt " +  name);
}

//form validation functions//
function placeErrors (error, element) {
	$(element).parent().addClass('has-error');
	$('.help-block', $(element).parent()).show().text($(error[0]).text());
}
function removeErrors (label, element) {
	$(element).parent().removeClass('has-error');
	$('.help-block', $(element).parent()).hide().text('');

}

function SetFeedbackForm () {
	$("#feedback-modal form").validate({
		rules: {
			'feedbackEmail': {
				required: true,
				email: true
			},
			'comments': {
				required: true
			}
		},
		submitHandler: function () {
			$.ajax({
				url: '/php/email.php',
				type: 'POST',
				dataType: 'json',
				data: {
					email: $("#feedbackEmail").val(),
					message: $("#inputComments").val()},
			})
			.done(function() {
				console.log("success");
			});
		},
		errorPlacement: placeErrors,
		success: removeErrors
	});
}

function SetFormValidation () {
	$.validator.addMethod("phoneUS", function(phone_number, element) {
	    phone_number = phone_number.replace(/\s+/g, "");
	    return this.optional(element) || phone_number.length > 9 &&
	        phone_number.match(/^(1-?)?(\([2-9]\d{2}\)|[2-9]\d{2})-?[2-9]\d{2}-?\d{4}$/);
	}, "Please specify a valid phone number");
	$('#form-adopt').validate({
		rules: {
			'email': {
				required: true,
				email: true,
				maxlength: 50
			},
			'contact': {
				required: true,
				maxlength: 50
			},
			'organization': {
				required: true,
				maxlength: 100
			},
			'phone': {
				required: true,
				maxlength: 14,
				phoneUS: true
			}
		},
		submitHandler: function () {
			$('#adopt-alert').hide();
            
			//$('#adopt-modal').bu
			$.ajax({
				url: config.adopt.url,
				dataType: 'json',
				data: {
					email: $('#inputEmail').val(),
					id: $('#inputId').val(),
					contact: $('#inputName').val(),
					organization: $('#inputOrg').val(),
					phone: $('#inputPhone').val()//,
					//shelter: shelterName
				},
				success: function (data) {
					if (data.success) {
						$('#adopt-modal').modal('hide');
						markers.clearLayers();
						GetShelters();
					} else if (data.error){
						$('#alert-message').text(data.error.msg);
						$('#adopt-alert').show();
						if (data.error.code == 99) {
							markers.clearLayers();
							GetShelters();
						}
					}
				}
			});
		},
		errorPlacement: placeErrors,
		success: removeErrors
	});
}
function FormMarkAllValid (){
	$('.form-group').removeClass('has-error');
	$('.form-group .help-block').hide();
}
//search functions//
function SearchByAddress (value, dataset) {
	$.ajax({
		url: config.search.url,
		format: 'jsonp',
		data: {
			f: 'json',
			returnGeometry: true,
			where: config.search.field + " = '" + value + "'",
			outSR: 4326
		}
	}).done(function (data) {
		var data = $.parseJSON(data);
		if (data.features.length > 0) {
			var point = L.latLng(data.features[0].geometry.y, data.features[0].geometry.x);
			map.setView(point, 16);
		}
	});
}
function SetSearch () {
	$('.typeahead').typeahead({
		name: 'addresses',
		remote: {
			url: config.search.url + "?f=json&outFields=" + config.search.field + "&returnGeometry=false",
			filter: function (resp) {
				var values = [];
				$(resp.features).each(function (i, feature) {
					values.push(feature.attributes[config.search.field]);
				});
				return values;
			},
			replace: function (url, query) {
				return url + "&where=" + config.search.searchField + " like '" + query.toUpperCase() + "%'";
			}
		}
	}).on('typeahead:selected', function(obj, datum, dataset) {
		SearchByAddress(datum.value, dataset);
	});
}

function clearForm () {
	FormMarkAllValid();
	$('#adopt-modal input').val('');
	$('#termsCheck').attr('checked', false);
	$('#submitButton').addClass('disabled');
}

$(document).ready(function () {
	if(typeof(Storage)!=='undefined') {
		if (window.localStorage.hideSplash === 'false' || !window.localStorage.hideSplash) {
			$('#splash-modal').modal('show');
		}
		$('#splash-modal button').click(function () {
			window.localStorage.setItem('hideSplash',($('#splash-modal input[type="checkbox"]').is(':checked')))
		});
	}
	SetMarkerSymbols();
	CreateMap();
	GetShelters();
	SetFeedbackForm();
	SetFormValidation();
	SetSearch();
	$('#adopt-modal').on('hidden.bs.modal', function (e) {
	  clearForm();
	});
    $('#termsCheck').change(function() {
        if($(this).is(':checked')) {
            $('#submitButton').removeClass('disabled');
        } else {
            $('#submitButton').addClass('disabled');
        }
    });
});
