var eta_data;
var stops_data;
var timer;

function create(type, text, append_to, ...attributes){
  element = document.createElement(type);
  append_to.append(element);
  element.append(document.createTextNode(text));

  if (typeof attributes !== 'undefined') {
    for (i in attributes) {
      element.setAttribute(attributes[i][0], attributes[i][1]);
    }
  }
}

function auto_refresh(timeout) {
  timer = setTimeout(() => get_eta_data(), timeout);
}

function get_stop_data() {
  const url = 'mtr_bus_stops.csv';

  fetch(url)
    .then(response => response.text())
    .then(text => {
      stops_data = $.csv.toArrays(text);
      stops_data.splice(0, 1);
    });
}

function get_eta_data() {
  const url = 'https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule';
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'language': 'zh',
      'routeName': $('#route').val()
    })
  };

  fetch(url, init)
    .then(response => response.text())
    .then(text => {
      eta_data = JSON.parse(text);
      refresh_output();
    })
    .catch(error => console.log(error));
}

function refresh_output() {
  $('#result').text('');
  
  function row_process(x) {
    secs = parseInt(x['departureTimeInSecond']);

    if (secs > 0) {
      time = new Date(last_update);
      time.setSeconds(time.getSeconds() + secs);
      
      if (secs > 59) {
        eta = Math.floor(secs / 60).toString() + 'm ' + (secs % 60).toString() + 's';
      } else {
        eta = secs + 's';
      }
    }
      
    row = document.createElement('tr');
    
    if (x['isScheduled'] == '1') {
      row.setAttribute('class', 'scheduled');
    } else if (secs < 59) {
      row.setAttribute('class', 'arriving');
    } else {
      row.setAttribute('class', 'normal');
    }
    
    create('td', x['busId'], row);
    create('td', time.toLocaleTimeString('en-GB'), row);
    create('td', eta, row);
    
    return row;
  }

  last_update = new Date(eta_data['routeStatusTime']);
  create('p', 'Data updated at: ' + last_update.toLocaleTimeString('en-GB'), $('#result'));
  
  stops = stops_data.filter((x) => { return x[0] === $('#route').val(); })
  
  for (let i = 0; i < stops.length; i++) {
    table = document.createElement('table');
    $('#result').append(table);

    row = document.createElement('tr');
    table.append(row);
    create('td', stops[i][7], row, ['colspan', '3']);
    /* create('td', i + '. ' + stops[i][7], row, ['colspan', '3']); */
    
    if (eta_data['busStop'].length > 0) {
      stop_eta = eta_data['busStop'];
      stop_eta = stop_eta.filter((x) => { return stops[i][3] === x['busStopId'] });

      if (stop_eta.length > 0) {
        for (let x of stop_eta[0]['bus']) {
          let condition = [
            $('#show_scheduled').is(':checked'),
            x['isScheduled'] == '0'
          ];
          
          if (condition.some(x => x)) {
            table.append(row_process(x));
          }
        };
      }
    }
    
    if (table.rows.length == 1) {
      create('td', 'No departure', table);
    }
  };
  
  let refresh_second = $('#auto_refresh').val();
  if (refresh_second > 0) {
    auto_refresh(refresh_second * 1000);
  }

  if ($('#result').is(':hidden')) {
    $('#result').addClass('result');
    $('#result').show();
    $('#show_scheduled').prop('disabled', 0);
  $('#auto_refresh').prop('disabled', 0);
  }
}

$(() => {
  $('#show_scheduled').prop('disabled', 1);
  $('#auto_refresh').prop('disabled', 1);
  $('#result').hide();
  get_stop_data();
});

$('#route').on('input', () => {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
  
  if ($('#route').val() == '') {
    $('#submit').prop('disabled', 1);
  } else {
    $('#submit').prop('disabled', 0);
  }
});

$('#submit').click(() => {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
  
  get_eta_data();
});

$('#reset').click(() => {
  $('#route').val('');
});

$('#show_scheduled').click(() => {
  refresh_output();
});