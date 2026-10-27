// Synthetic fixtures are confined to automated tests, never the marketplace.
export const TEST_LISTING = {
  id:'fixture-space',hostId:'fixture-host',title:'Automated test parking',city:'Delhi',area:'Test area',
  address:'Test-only property address',description:'A synthetic space used only by the automated test suite.',
  vehicleTypes:['car','bike','suv'],pricePerHour:5000,washPrice:24900,capacity:2,
  amenities:['Covered'],imageUrl:'/api/photos/abcd-1234.jpg',lat:28.6,lng:77.2,status:'active',
  openingTime:'00:00',closingTime:'00:00',blockedDates:[],
};
