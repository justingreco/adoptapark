var config = {
	parks: {
		url: 'http://localhost/parksrest/v1/ws_geo_attributequery.php',
		table: 'parks.parks_geojson'
	},
	adopt: {
		url: 'http://localhost/parksrest/v1/ws_parks_adopt.php'
	},
	search: {
		url: 'http://maps.raleighnc.gov/arcgis/rest/services/Addresses/MapServer/0/query',
		field: 'ADDRESS',
		searchField: 'ADDRESSU'
	}
};
var map, greenMarker, redMarker, markers, polys, parkName, selected, lastColor;
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
        L.tileLayer('http://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png',{minZoom: 10, attribution: 'Tiles courtesy of <a href="http://openstreetmap.se/" target="_blank">OpenStreetMap Sweden</a> &mdash; Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'}).addTo(map);
	/*L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom: 16, attribution: 'Esri, DeLorme, NAVTEQ'}).addTo(map);*/
	//paths = L.layerGroup().addTo(map);
	//markers = L.layerGroup().addTo(map);
	if (Modernizr.geolocation) {
        L.control.locate().addTo(map);
    }
}
//display parks on map//

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

function GetParks () {
	$.ajax({
		url: config.parks.url,
		data: {
			table: config.parks.table,
			fields: '*'
		},
		cache: false,
		success: function (data) {
			SetSearch(data);

			var markerJson = [],
				polyJson = [];


			$.each(data, function (i, park) {
				var geom = $.parseJSON(park.center),
					icon = greenMarker;
				if (park.start) {
					icon = redMarker;
				}


				markerJson.push({type: 'Feature',
					properties: {
						name: park.name,
						adopters: park.adopters,
						id: park.id
					},
					geometry: {
						type: 'Point',
						coordinates: geom.coordinates
					}
				});

				polyJson.push({type: 'Feature',
					properties: {
						name: park.name,
						adopters: park.adopters,
						id: park.id
					},
					geometry: $.parseJSON(park.geom)
					
				});
			});


			markers = L.geoJson(markerJson, {
				onEachFeature: function (feature, layer) {
					var icon = L.divIcon({
					html: feature.properties.adopters,
					className: 'park-icon',
					iconSize: [40,40]
				});
				layer.setIcon(icon);
				var content = '<div class="text-center" data-id="'+feature.properties.id+'"><h5>' + feature.properties.name + "</h5><p>" + feature.properties.adopters + " adopters</p><button data-id='" + feature.properties.id + "' data-name='" + feature.properties.name + "'  data-toggle='modal' data-target='#adopt-modal' class='btn btn-success'>Adopt Me</button></div>";
				layer.bindPopup(content);
				layer.on('popupopen', popupOpen);
			}}).addTo(map);
			polys = L.geoJson(polyJson, {
				onEachFeature: function (feature, layer) {
					var content = '<div class="text-center" data-id="'+feature.properties.id+'"><h5>' + feature.properties.name + "</h5><p>" + feature.properties.adopters + " adopters</p><button data-id='" + feature.properties.id + "' data-name='" + feature.properties.name + "'  data-toggle='modal' data-target='#adopt-modal' class='btn btn-success'>Adopt Me</button></div>";
					layer.bindPopup(content);
					layer.on('popupopen', popupOpen);
					layer.setStyle({color:'green', opacity: 0.80});

			}}).addTo(map);			
		}
	});
}

function highlightPark (park) {
	if (selected) {
		$.each(selected, function (i, selection) {
			selection.setStyle({color:lastColor});
		});
		
	}
	selected = [];

	if (park._layers) {
		$.each(park.getLayers(), function (i, l) {
			selected.push(l);
			lastColor = l.options.color;
			l.setStyle({color:'yellow', opacity: 0.80});
		});
	} else {
		selected.push(park);
		lastColor = park.options.color;
		park.setStyle({color:'yellow', opacity: 0.80});
	}
}

function popupOpen () {
	var id = $("button", (this._popupContent) ? this._popupContent : this._popup.getContent()).data('id'),
		name = $("button", (this._popupContent) ? this._popupContent : this._popup.getContent()).data('name');
	parkName = name;
	$('#inputId').val(id);
	$("#adopt-modal .modal-title").text("Adopt " +  name);

	if (this.feature.geometry.type === 'Point') {
		var marker = this;
		polys.eachLayer(function (layer) {
			var lPopup = (layer._popupContent) ? layer._popupContent : layer._popup.getContent();
			if ($(lPopup).data('id') === $(marker.getPopup().getContent()).data('id')) {
				highlightPark(layer);
			}
		});		
	} else {
		highlightPark(this);
	}
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
					//park: parkName
				},
				success: function (data) {
					if (data.success) {
						$('#adopt-modal').modal('hide');
						markers.clearLayers();
						GetParks();
					} else if (data.error){
						$('#alert-message').text(data.error.msg);
						$('#adopt-alert').show();
						if (data.error.code == 99) {
							markers.clearLayers();
							GetParks();
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
function SetSearch (data) {
/*	$('.typeahead').typeahead({
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
	});*/
	var parks = new Bloodhound({
	  datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
	  queryTokenizer: Bloodhound.tokenizers.whitespace,
	  // `states` is an array of state names defined in "The Basics"
	  local: $.map(data, function(data) { return { value: data.name }; })
	});
	parks.initialize();
	$('.typeahead').typeahead({
		  hint: false,
		  highlight: true,
		  minLength: 1
		},
		{
		  name: 'parks',
		  displayKey: 'value',
		  // `ttAdapter` wraps the suggestion engine in an adapter that
		  // is compatible with the typeahead jQuery plugin
		  source: parks.ttAdapter()
		}).on('typeahead:selected', function(obj, datum, dataset) {
			markers.eachLayer(function (layer) {
				if (layer.feature.properties.name === datum.value) {
					layer.openPopup();
					map.setView(layer.getLatLng(), 16);
				}
			});
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
	GetParks();
	SetFeedbackForm();
	SetFormValidation();
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
