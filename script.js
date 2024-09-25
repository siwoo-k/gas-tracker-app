let map, places, geocoder, infowindow, distancematrix;

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { Place, SearchNearbyRankPreference  } = await google.maps.importLibrary("places");

  geocoder = new google.maps.Geocoder();
  infowindow = new google.maps.InfoWindow();
  distancematrix = new google.maps.DistanceMatrixService();
  places = Place;
  rankPreference = SearchNearbyRankPreference;

  map = new Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 16,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM 
    },
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [{ visibility: "off" }], // turns off pins on map
      },
      {
        featureType: "transit",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
    ],
  });

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

initMap();