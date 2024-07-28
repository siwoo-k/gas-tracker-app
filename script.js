let map, geocoder, places, rankPreference, infoWindow, markers = [];

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary("places");

  map = new Map(document.getElementById("map"), {
    center: { lat: 33.649, lng: -117.840 },
    zoom: 16,
  });

  geocoder = new google.maps.Geocoder();
  places = Place;
  rankPreference = SearchNearbyRankPreference;
  infoWindow = new google.maps.InfoWindow();
}

initMap();

async function getGeocode() {
  const address = document.getElementById('search-bar').value;
  convertAddress(address);
}

async function convertAddress(address) {
  geocoder.geocode({ 'address': address }, function(results, status) {
    if (status === 'OK') {
      map.setCenter(results[0].geometry.location);
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
             "fuelOptions", 
             "evChargeOptions", 
             "regularOpeningHours"],
    locationRestriction: {
      center: location,
      radius: 5000,
    },
    includedPrimaryTypes: ["gas_station"],
    maxResultCount: 10,
    rankPreference: rankPreference.DISTANCE,
    language: "en-US",
  };

  try {
    const response = await places.searchNearby(request);
    const results = response.places;
    clearResults();
    clearMarkers();
    for (let place of results) {
      let gasData = appendResults(place);
      createMarker(place, gasData);
    }
  } catch (error) {
    alert('Places service was unsuccessful: ' + error.message);
  }
}

function appendResults(place) {
  const resultsList = document.getElementById('results-list');
  const listItem = document.createElement('li');

  let gasData = `<div class="gas-data"><strong>${place.displayName}</strong><br><span class="gas-address">${place.formattedAddress}</span><br>`

  if (place.fuelOptions && place.fuelOptions.fuelPrices) {
    gasData += `<span class="gas-prices">`;

    const fuelPricesArray = place.fuelOptions.fuelPrices.map(fuelPrice => {
      const price = (fuelPrice.price.units + fuelPrice.price.nanos / 1e9).toFixed(2);
      return `${fuelPrice.type} &#36;${price} ${fuelPrice.price.currencyCode}`;
    });
  
    gasData += fuelPricesArray.reverse().join('<br>') + `</span>`;
  }

  gasData += `</div>`;

  listItem.innerHTML = gasData;

  resultsList.appendChild(listItem);
  return gasData;
}

function createMarker(place, gasData) {
  const marker = new google.maps.Marker({
    map: map,
    position: place.location,
  });

  google.maps.event.addListener(marker, 'mouseover', function() {
    infoWindow.setContent(gasData);
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
}

function clearMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
}