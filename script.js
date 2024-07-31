let map, geocoder, places, rankPreference, infoWindow, markers = [], autocomplete, lastMarker, isAutoComplete, addresses = [];

let initialRad = 3000;
let incrementRad = 3000;
let maxRad = 24000; // approximately 15 miles

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary("places");

  map = new Map(document.getElementById("map"), {
    center: { lat: 33.649, lng: -117.840 },
    zoom: 16,
    disableDefaultUI: true,
    mapTypeControl: true,
    mapTypeControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
    }
  });

  geocoder = new google.maps.Geocoder();
  places = Place;
  rankPreference = SearchNearbyRankPreference;
  infoWindow = new google.maps.InfoWindow();

  const input = document.getElementById('search-bar');

  autocomplete = new google.maps.places.Autocomplete(input);

  autocomplete.addListener('place_changed', fillInAddress);

  document.getElementById('search-bar').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      document.activeElement.blur(); // prevent auto complete from entering submission again
      getGeocode();
    }
  });
}

async function fillInAddress() {
  const place = autocomplete.getPlace();
  const address = place.formatted_address;

  const selectedAddressDiv = document.getElementById('autocomplete-list');
  selectedAddressDiv.textContent = `Selected Address: ${address}`;

  getGeocode();
}

async function getGeocode() {
  // clear previous results if any
  clearResults();
  clearMarkers();

  const address = document.getElementById('search-bar').value;

  if (address.trim() == "") {
    const location = map.getCenter();
    createCenterMarker(location, address);
    searchGasStations(location);
  } else {
    convertAddress(address);
  }
}

async function convertAddress(address) {
  geocoder.geocode({ 'address': address }, function(results, status) {
    if (status === 'OK') {
      map.setCenter(results[0].geometry.location);
      createCenterMarker(results[0].geometry.location);
      searchGasStations(results[0].geometry.location);
    } else {
      alert('Geocoder was unsucessful: ' + status);
    }
  });
}

async function searchGasStations(location) {
  const request = {
    fields: ["displayName", 
             "location", 
             "formattedAddress", 
             "fuelOptions"],
    locationRestriction: {
      center: location,
      radius: initialRad,
    },
    includedPrimaryTypes: ["gas_station"],
    maxResultCount: 15,
    language: "en-US",
  };

  try {
    const response = await places.searchNearby(request);
    const results = response.places;

    const filteredResults = results.filter(place => 
      place.fuelOptions && place.fuelOptions.fuelPrices && !addresses.includes(place.formattedAddress)
    );

    if (filteredResults.length === 0) {
      initialRad += incrementRad;
      if (initialRad > maxRad) {
        alert('Maximum search radius reached; try a different location');
        return;
      }
      searchGasStations(location); // recursively call if no new results are returned
      return;
    }
    
    for (let place of filteredResults) {
      appendResults(place);
      createMarker(place);
      addresses.push(place.formattedAddress);
    }
    const resultsList = document.getElementById('results-list');
    const showMoreButton = document.createElement('div');

    showMoreButton.innerHTML = `<button id=show-more-button onclick="showMoreResults()">show more</button>`;

    resultsList.appendChild(showMoreButton);
  } catch (error) {
    alert('Places service was unsuccessful: ' + error.message);
  }
}

function appendResults(place) {
  const resultsList = document.getElementById('results-list');
  const listItem = document.createElement('li');

  let gasData = `<div class="gas-data"><strong>${place.displayName}</strong><br><span class="gas-address">${place.formattedAddress}</span><br>`

  gasData += `<span class="gas-prices">`;

  const fuelPricesArray = place.fuelOptions.fuelPrices.map(fuelPrice => {
    const price = (fuelPrice.price.units + fuelPrice.price.nanos / 1e9).toFixed(2);
    return `${fuelPrice.type} &#36;${price} ${fuelPrice.price.currencyCode}`;
  });

  gasData += fuelPricesArray.reverse().join('<br>') + `</span>`;

  gasData += `</div>`;

  listItem.innerHTML = gasData;

  listItem.dataset.latitude = place.location.lat();
  listItem.dataset.longitude = place.location.lng();
  listItem.dataset.markerIndex = markers.length;

  listItem.addEventListener('click', function() {
    const lat = parseFloat(this.dataset.latitude);
    const lng = parseFloat(this.dataset.longitude);
    map.panTo({ lat: lat, lng: lng });

    if (lastMarker != null && lastMarker <= markers.length - 1) {
      markers[lastMarker].setIcon({
        url: "images/icons/marker.png",
        scaledSize: new google.maps.Size(32, 32),
      })
    }

    for (let i = 0; i < markers.length; i++) {
      const markerPosition = markers[i].getPosition();
      if (markerPosition.lat() === lat && markerPosition.lng() === lng) {
        lastMarker = i;
        markers[i].setIcon({
          url: "images/icons/marker.png",
          scaledSize: new google.maps.Size(48, 48),
        })
        break;
      }
    }
  });

  resultsList.appendChild(listItem);
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

  const gasItem = document.createElement('div');
  gasItem.setAttribute("class", "gas-data")

  const fuelPricesArray = place.fuelOptions.fuelPrices.map(fuelPrice => {
    const price = (fuelPrice.price.units + fuelPrice.price.nanos / 1e9).toFixed(2);
    return `${fuelPrice.type} &#36;${price} ${fuelPrice.price.currencyCode}`;
  });

  gasItem.innerHTML = `<strong>
                   ${place.displayName}
                 </strong><br>
                   <span class="gas-address">
                 ${place.formattedAddress}
                   </span><br>
                 <span class="gas-prices">` + 
                 fuelPricesArray.reverse().join('<br>') + 
                 `</span></div>`;

  google.maps.event.addListener(marker, 'mouseover', function() {
    infoWindow.setContent(gasItem);
    infoWindow.open(map, marker);
  });

  google.maps.event.addListener(marker, 'mouseout', function() {
    infoWindow.close();
  });

  markers.push(marker);
}

function clearResults() {
  const resultsList = document.getElementById('results-list');
  while (resultsList.firstChild) {
    resultsList.removeChild(resultsList.firstChild);
  }
  while (addresses.firstChild) {
    addresses.removeChild(addresses.firstChild);
  }
  addresses = [];
  initialRad = 3000; // reset initial radius
}

function clearMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
  lastMarker = null;
}

function createCenterMarker(location, address) {
  const marker = new google.maps.Marker({
      map: map,
      position: location,
      title: "Your location",
      icon: {
        url: "images/icons/your-location.png",
        scaledSize: new google.maps.Size(16, 16),
      },
  });

  markers.push(marker);
}

async function showMoreResults() {
  const resultsList = document.getElementById('results-list');
  resultsList.removeChild(resultsList.lastChild); // remove button
  if (markers.length > 40) {
    alert('Maximum search result reached; try a different location');
    return;
  }
  
  initialRad += incrementRad;
  if (initialRad > maxRad) {
    alert('Maximum search radius reached; try a different location');
    return;
  }
  const location = markers[0].getPosition(); // get position of center marker
  searchGasStations(location);
}

initMap();