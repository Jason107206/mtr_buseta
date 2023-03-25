var eta_data;

function auto_refresh(timeout) {
   setTimeout(function () {
      get_eta_data();
   }, timeout);
}

function get_stop_data() {
  
}

function get_eta_data() {
  const route = document.getElementById('route').value;
  if (route != '') {
    const url = 'https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule'
    const data = {
      'language': 'zh', 
      'routeName': document.getElementById('route').value
    }
  
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }, 
      body: JSON.stringify(data)
    }).then(response => {
      response.text().then(text => {
        eta_data = JSON.parse(text);
        refresh_output(eta_data);
      })
    });
  }
}

function refresh_output(eta_data) {
  function text_process(x) {
    let eta_text_of_item = '';
    departure_second = parseInt(x['departureTimeInSecond']);
    
    if (departure_second > 0) {
      departure_time = new Date(last_update);
      departure_time.setSeconds(departure_time.getSeconds() + departure_second);

      if (departure_second > 59) {
        departure_time_text = 
          Math.floor(departure_second / 60).toString() + 
          'm ' + 
          (departure_second % 60).toString() + 
          's';
      } else {
        departure_time_text = 
          departure_second + 
          's';
      }
      
      eta_text_of_item += 
        x['busId'] + 
        ': ' + 
        departure_time.toLocaleTimeString('en-GB') + 
        ' — ' + 
        departure_time_text;

      if (x['isScheduled'] == '1') {
        eta_text_of_item += ' — Scheduled';
      }

      eta_text_of_item += '<br>'
    }

    return eta_text_of_item;
  }

  const last_update = new Date(eta_data['routeStatusTime']);
  
  let text_output = 
    'Last update: ' + 
    last_update.toLocaleTimeString('en-GB') + 
    '<p>';
  
  for (let i = 0; i < eta_data['busStop'].length; i++) {
    text_output += eta_data['busStop'][i]['busStopId'] + ': <br>';

    let eta_text_of_stop = '';
    for (let x of eta_data['busStop'][i]['bus']) {
      if (document.getElementById('show_scheduled').checked) {
        eta_text_of_stop += text_process(x);
      } else {
        if (x['isScheduled'] == '0') {
          eta_text_of_stop += text_process(x);
        }
      }
    };

    if (eta_text_of_stop == '') {
      text_output += 'No departure <br>';
    } else {
      text_output += eta_text_of_stop;
    }

    text_output += '<br>';
  };
  
  document.getElementById('result').innerHTML = text_output;
  
  let refresh_second = document.getElementById('auto_refresh').value;
  if (refresh_second > 0) {
    auto_refresh(refresh_second * 1000);
  }
}

document.getElementById('submit').onclick = function () {
  get_eta_data();
}

document.getElementById('reset').onclick = function() {
   document.getElementById('route').value = '';
}

document.getElementById('show_scheduled').onclick = function() {
  refresh_output(eta_data);
}