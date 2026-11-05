define(function() {
    // ======== Edited by Luke 2017-01-20 ========
    // 新增baseUrl config
    return {
      'api': { protocol:location.protocol, host: location.hostname, port: location.protocol == 'https'?'443':'80', debug: true  },
      'baseUrl' : "",
      'restApi': '/cateringservice/rest/API/',
      'console': true,
      'numberOfSearchHistory': 5,
      'backstageUrl': '/cateringservice/web/main/',
      'dishImageBaseUrl': '/dish/pic/',
      'resetPasswordUrl': '/index.html',
      'dishDefaultImage': '/dish/pic/xxxxx',
      'restaurantDefaultImage': '/kitchen/logo/xxxxx',
      'cooperativeDefaultImage': 'img/cooperative_placeholder.png',
      'schoolListApiKey': '70a7735e01bb7b953732e3f354d0d073e38c50b72d47e0c582f380005ac7bf7e'
    };
});
