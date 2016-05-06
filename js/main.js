var config = {
	parks: {
		url: 'http://openmaps.raleighnc.gov/parksapi/v1/ws_geo_attributequery.php',
		table: 'parks.parks_geojson'
	},
	adopt: {
		url: 'http://openmaps.raleighnc.gov/parksapi/v1/ws_parks_adopt.php'
	},
	search: {
		url: 'http://maps.raleighnc.gov/arcgis/rest/services/Addresses/MapServer/0/query',
		field: 'ADDRESS',
		searchField: 'ADDRESSU'
	},
	maxAdopters: 5
};
var map, greenMarker, redMarker, markers, polys, parkName, selected, lastColor, adopters = [];
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
						parkfull: park.parkfull,
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
						parkfull: park.parkfull,
						id: park.id
					},
					geometry: $.parseJSON(park.geom)
				});
			});
			markers = L.geoJson(markerJson, {
				onEachFeature: function (feature, layer) {
					var className = 'park-icon';
					if (feature.properties.parkfull) {
						className = 'full-icon';
					} else if (feature.properties.adopters > 0) {
						className = 'adopted-icon';
					}
					var icon = L.divIcon({
					//html: feature.properties.adopters,
					className: className,
					iconSize: [40,40]
				});

				layer.setIcon(icon);
				layer.bindPopup(buildContent(feature));
				layer.on('popupopen', popupOpen);
				layer.on('popupclose', unhighlightPark);
			}}).addTo(map);
			polys = L.geoJson(polyJson, {
				onEachFeature: function (feature, layer) {
					var color = 'green';
					if (feature.properties.parkfull) {
						color = 'red';
					} else {
						if (feature.properties.adopters > 0) {
							color = 'orange';
						}
					}
					layer.bindPopup(buildContent(feature));
					layer.on('popupopen', popupOpen);
					layer.setStyle({color:color, opacity: 0.80});
			}}).addTo(map);
		}
	});
}
function buildContent (feature) {
	var content = '<div class="text-center"><h4 data-id="' + feature.properties.id + '">' + feature.properties.name + '</h4>';
	if (feature.properties.adopters > 0) {
		content += "<strong>Adopters</strong><ul id='adoptersList'></ul><div class='pager row' style='display:none'><a href='#' onclick='showLastAdopters(event)'><span class='glyphicon glyphicon-chevron-left'></span> Previous</a><a href='#' onclick='showNextAdopters(event)'>Next <span class='glyphicon glyphicon-chevron-right'></span></a></div>"
	}
	if (!feature.properties.parkfull) {
		content += "<button data-id='" + feature.properties.id + "' data-name='" + feature.properties.name + "'  data-toggle='modal' data-target='#adopt-modal' class='btn btn-success'>Adopt Me</button></div>";
	} else {
		content += "<div class='alert alert-danger'>Park is fully adopted</div>";
	}
	return content;
}
function unhighlightPark () {
	$.each(selected, function (i, selection) {
		selection.setStyle({color:lastColor});
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
	var id = $("h4", (this._popupContent) ? this._popupContent : this._popup.getContent()).data('id'),
		name = $("button", (this._popupContent) ? this._popupContent : this._popup.getContent()).data('name');
	parkName = name;
	getAdopterNames(id, this);
	$('#inputId').val(id);
	$("#adopt-modal .modal-title").text("Adopt " +  name);
	if (this.feature.geometry.type === 'Point') {
		var marker = this;
		polys.eachLayer(function (layer) {
			var lPopup = (layer._popupContent) ? layer._popupContent : layer._popup.getContent();
			if ($("h4", lPopup).data('id') === $("h4", marker.getPopup().getContent()).data('id')) {
				highlightPark(layer);
			}
		});
	} else {
		highlightPark(this);
	}
}
function getAdopterNames (id, popup) {
	$.ajax({
		url: config.parks.url,
		data: {
			table: 'parks.adopters',
			fields: 'display',
			parameters: 'parksfk = ' + id,
			order: 'display'
		},
		cache: false,
		success: function (data) {
			adopters = data;
			var content = null;
			if (popup._popup) {
				content = $(popup.getPopup().getContent());
			} else {
				content = $(popup._popupContent);
			}
			var list = $('ul', content).empty();
			if (adopters.length > config.maxAdopters) {
				$('.pager', content).css('display', 'block');
				$('.pager a:first', content).css('visibility', 'hidden');
				$('.pager a:last', content).css('visibility', 'visible');
			} else {
				$('.pager', content).css('visibility', 'hidden');
			}
			for (var i = 0; i < config.maxAdopters && i < adopters.length; i++) {
				list.append('<li>' + adopters[i].display + '</li>');
			}
			list.attr('data-page', 0);
			if (popup._popup) {
			popup.setPopupContent('<div>' + content.html() + '</div>');
			} else {
				popup.bindPopup('<div>' + content.html() + '</div>');
			}
		}
	});
}
function showLastAdopters (e) {
	list = $(e.target).parent().parent().find('ul').empty();
	var page = list.data('page') - 1;
	list.data('page', page);
	if (page > 0) {
		$('.pager a:first', list.parent()).css('visibility', 'visible');
		$('.pager a:last', list.parent()).css('visibility', 'visible');
	} else {
		$('.pager a:first', list.parent()).css('visibility', 'hidden');
		$('.pager a:last', list.parent()).css('visibility', 'visible');
	}
	for (var i = page * config.maxAdopters; i < (page + 1) * config.maxAdopters; i++) {
		var a = adopters[i];
		list.append('<li>' + a.display + '</li>');
	}
}
function showNextAdopters (e) {
	list = $(e.target).parent().parent().find('ul').empty();
	var page = list.data('page') + 1;
	list.data('page', page);
	if (page > 0) {
		$('.pager a:first', list.parent()).css('visibility', 'visible');
	}
	if ((page + 1) * config.maxAdopters > adopters.length) {
		$('.pager a:last', list.parent()).css('visibility', 'hidden');
	}
	for (var i = page * config.maxAdopters; i < (page + 1) * config.maxAdopters && i < adopters.length; i++) {
		var a = adopters[i];
		list.append('<li>' + a.display + '</li>');
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
						polys.clearLayers();
						GetParks();
					} else if (data.error){
						$('#alert-message').text(data.error.msg);
						$('#adopt-alert').show();
						if (data.error.code == 99) {
							markers.clearLayers();
							polys.clearLayers();
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
	var addresses = new Bloodhound({
		datumTokenizer: function (datum) {
	        return Bloodhound.tokenizers.whitespace(datum.value);
	    },
	    queryTokenizer: Bloodhound.tokenizers.whitespace,
		remote: {
			url: config.search.url + "?orderByFields=ADDRESS&returnGeometry=false&outFields=ADDRESS&returnDistinctValues=false&f=json",
			filter: function (resp) {
				var data = []
				if (resp.features.length > 0) {
					$(resp.features).each(function (i, f) {
						data.push({value:f.attributes['ADDRESS']});
					});
				}
				return data;},
			replace: function(url, uriEncodedQuery) {
			      var newUrl = url + '&where=ADDRESSU like ' + "'" + uriEncodedQuery.toUpperCase() +"%'";
			      return encodeURI(newUrl);
			}
		}
	});
	var parks = new Bloodhound({
	  datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
	  queryTokenizer: Bloodhound.tokenizers.whitespace,
	  // `states` is an array of state names defined in "The Basics"
	  local: $.map(data, function(data) { return { value: data.name }; })
	});
	addresses.initialize();
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
		  source: parks.ttAdapter(),
			templates: {
				header: '<h5>Parks</h5>'
			}
		},
		{
			name: 'address',
			displayKey: 'value',
			source: addresses.ttAdapter(),
			templates: {
				header: '<h5>Address</h5>'
			}
		}
		).on('typeahead:selected', function(obj, datum, dataset) {
			if (dataset === 'parks') {
				markers.eachLayer(function (layer) {
					if (layer.feature.properties.name === datum.value) {
						layer.openPopup();
						map.setView(layer.getLatLng(), 16);
					}
				});
			} else {
				SearchByAddress(datum.value, dataset);
			}
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
