let map, places, geocoder, infowindow, distancematrix, markers = [], index;

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { Place } = await google.maps.importLibrary("places");

  geocoder = new google.maps.Geocoder();
  infowindow = new google.maps.InfoWindow();
  distancematrix = new google.maps.DistanceMatrixService();
  places = Place;

  map = new Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 16,
    disableDefaultUI: true,
    mapTypeControl: true,
    mapTypeControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
    }
  });

  google.maps.event.addListener(map, "zoom_changed", function() {
    document.getElementById('show-gas-button').style.opacity = 1;
  });

  google.maps.event.addListener(map, "dragend", function() {
    document.getElementById('show-gas-button').style.opacity = 1;
  });

  initNavigationActions();
  centerOnUser();
}

function centerOnUser() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        let pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.panTo({ lat: pos.lat, lng: pos.lng });
      },
      function(error) {
        alert("Allow location permission to find your address: ", error);
      }
    );
  }
}

async function initNavigationActions() {
  const input = document.getElementById('search-bar');
  let autocomplete = new google.maps.places.Autocomplete(input);

  autocomplete.addListener('place_changed', () => {
    const address = document.getElementById('search-bar').value.trim();
    geocoder.geocode({ 'address': address }, function(results, status) {
      if (status === 'OK') {
        const location = results[0].geometry.location;
        map.setCenter(location);
      } else {
        alert('Geocoder was unsucessful: ' + status);
      }
    });
    document.getElementById('show-gas-button').style.opacity = 1;
  });

  document.getElementById('search-bar').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      document.activeElement.blur();
      getGeocode();
    }
  });

  document.getElementById('find-me-button').addEventListener('click', () => {
    centerOnUser();
    document.getElementById('show-gas-button').style.opacity = 1;
  });

  document.getElementById('show-gas-button').addEventListener('click', function() {
    getGeocode();
    this.style.opacity = 0; // hide button after results
  });

  document.getElementById('clear-result-button').addEventListener('click', () => {
    clearInput();
    clearResults();
    clearMarkers();
    document.getElementById('show-gas-button').style.opacity = 0;
  });
}

let size = 3220; // approximately 2 miles
const increaseSize = 3320, maxSize = 16090; // approximately 10 miles

async function getGeocode() {
  clearResults();
  clearMarkers();

  const address = document.getElementById('search-bar').value.trim();

  if (address === "") { // search using map crosshair (no address typed in search-bar)
    const location = map.getCenter();
    showGasStations(location);
  } else {
    transformAddress(address);
  }
}

async function transformAddress(address) {
  geocoder.geocode({ 'address': address }, function(results, status) {
    if (status === 'OK') {
      const location = results[0].geometry.location;
      map.setCenter(location);
      showGasStations(location);
    } else {
      alert('Geocoder was unsucessful: ' + status);
    }
  });
}

async function showGasStations(location) {
  const request = {
    fields: ["displayName", 
             "location", 
             "formattedAddress", 
             "fuelOptions"],
    locationRestriction: {
      center: location,
      radius: size,
    },
    includedPrimaryTypes: ["gas_station"],
    maxResultCount: 10,
    language: "en-US",
  };

  try {
    const response = await places.searchNearby(request);
    const results = response.places.filter(place => 
      place.fuelOptions && place.fuelOptions.fuelPrices // && !addresses.includes(place.formattedAddress)
    );

    if (results.length === 0) {
      size += increaseSize;
      if (size > maxSize) {
        alert('Maximum search radius reached; try a different location');
        return;
      }
      showGasStations(location); // recursively call if no new results are returned
    }
    
    for (let place of results) {
      await appendResults(place);
      // addresses.push(place.formattedAddress);
    }

  } catch (error) {
    alert('Places service was unsuccessful: ' + error.message);
  }
}

async function appendResults(place) {
  const results = document.getElementById('results-list');
  const gasitem = document.createElement('li');

  const fueldata = place.fuelOptions.fuelPrices.map(fuelPrice => {
    const price = (fuelPrice.price.units - 0.01 + fuelPrice.price.nanos / 1e9).toFixed(2);
    if (fuelPrice.type === 'REGULAR_UNLEADED') {
      return `REGULAR <br>&#36;${price} ${fuelPrice.price.currencyCode}`;
    }
    return `${fuelPrice.type} <br>&#36;${price} ${fuelPrice.price.currencyCode}`;
  });

  let distanceinfo = "";
  let response = await getDistanceInfo(place);

  if (response !== undefined) {
    if (parseFloat(response[0]) > 2 * 1.15) {
      return; // dont append current data since it's more than 2 miles
    }
    distanceinfo = `<span class="distance-info">
                      ${response[0]} miles away
                      <span class="hidden-info">
                        ${response[1]}
                      </span>
                    </span>
                    <br>`;      
  }
  let fuelordered = fueldata.reverse().map(price => `<span>${price}</span>`).join('');

  gasitem.innerHTML = `<span style="font-weight: 500;">
                          ${place.displayName}
                        </span>
                        <br>
                        <span class="gas-address">
                          ${place.formattedAddress}
                        </span><br>
                        <div class="gas-data-div">
                          ${fuelordered}
                        </div>
                        <span style="font-size: 14px; font-weight: 400;";>
                          ${distanceinfo}
                        </span>
                        </div>`;

  gasitem.dataset.latitude = place.location.lat();
  gasitem.dataset.longitude = place.location.lng();
  gasitem.dataset.markerIndex = markers.length;

  gasitem.addEventListener('click', function() {
    const lat = parseFloat(this.dataset.latitude);
    const lng = parseFloat(this.dataset.longitude);
    map.panTo({ lat: lat, lng: lng });

    if (index != null && index <= markers.length - 1) {
      markers[index].setIcon({
        url: "images/icons/marker.png",
        scaledSize: new google.maps.Size(32, 32),
      })
    }

    for (let i = 0; i < markers.length; i++) {
      const markerpos = markers[i].getPosition();
      if (markerpos.lat() === lat && markerpos.lng() === lng) {
        index = i;
        markers[i].setIcon({
          url: "images/icons/marker.png",
          scaledSize: new google.maps.Size(48, 48),
        })
        break;
      }
    }
  });

  results.appendChild(gasitem);
  createMarker(place); // add markers here
}

async function getDistanceInfo(place) {
  const request = {
    origins: [map.getCenter()], 
    destinations: [place.location], 
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.IMPERIAL,
  };

  try {
    const response = await new Promise((resolve, reject) => {
      distancematrix.getDistanceMatrix(request, (response, status) => {
        if (status === google.maps.DistanceMatrixStatus.OK) {
          resolve(response);
        } else {
          reject(new Error(`Distance Matrix request failed with status: ${status}`));
        }
      });
    });
    const results = response.rows[0].elements[0];
    const distance = results.distance.text;
    const duration = results.duration.text;

    return [distance, duration];
  } catch (error) {
    // do nothing here
  }
}

function createMarker(place) {
  const marker = new google.maps.Marker({
    map: map,
    position: place.location,
    icon: {
      url: "images/icons/marker.png",
      scaledSize: new google.maps.Size(32, 32),
    }
  });

  const gasdata = document.createElement('div');
  gasdata.setAttribute("class", "gas-data")

  const fuelPricesArray = place.fuelOptions.fuelPrices.map(fuelPrice => {
    const price = (fuelPrice.price.units - 0.01 + fuelPrice.price.nanos / 1e9).toFixed(2);
    if (fuelPrice.type === 'REGULAR_UNLEADED') {
      return `REGULAR &ensp;&#36;${price} ${fuelPrice.price.currencyCode}`;
    }
    return `${fuelPrice.type} &ensp;&#36;${price} ${fuelPrice.price.currencyCode}`;
  });

  gasdata.innerHTML = `<strong>
                         ${place.displayName}
                       </strong><br>
                       <span class="gas-address">
                         ${place.formattedAddress}
                       </span><br>
                       <span class="gas-prices">` + 
                         fuelPricesArray.reverse().join('<br>') + 
                      `</span></div>`;

  google.maps.event.addListener(marker, 'mouseover', function() {
    infowindow.setContent(gasdata);
    infowindow.open(map, marker);
  });

  google.maps.event.addListener(marker, 'mouseout', function() {
    infowindow.close();
  });

  google.maps.event.addListener(marker, 'click', function() {
    const gasitem = document.querySelector(`li[data-latitude="${place.location.lat()}"][data-longitude="${place.location.lng()}"]`);
    if (gasitem) {
      gasitem.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (index != null && index <= markers.length - 1) {
      markers[index].setIcon({
        url: "images/icons/marker.png",
        scaledSize: new google.maps.Size(32, 32),
      });
    }

    for (let i = 0; i < markers.length; i++) {
      const markerpos = markers[i].getPosition();
      if (markerpos.lat() === place.location.lat() && markerpos.lng() === place.location.lng()) {
        index = i;
        markers[i].setIcon({
          url: "images/icons/marker.png",
          scaledSize: new google.maps.Size(48, 48), 
        });
        break;
      }
    }
  });

  markers.push(marker);
}

function clearResults() {
  const results = document.getElementById('results-list');
  while (results.firstChild) {
    results.removeChild(results.firstChild);
  }
  size = increaseSize; // reset initial radius
}

function clearMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
  index = null;
}

function clearInput() {
  var input = document.getElementById('search-bar');
  input.value = "";
}

initMap();