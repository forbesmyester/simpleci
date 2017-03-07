function renderMain() {

    function getNow() {
        var d = new Date();
        return d.getFullYear() + '-' + (d.getMonth() + 1);
    }

    function pad2(n) {
        var p = '';
        if (n < 10) { p = '0'; }
        return p + n;
    }

    function getPrevious(now) {
        var ym = now.split('-').map((n) => parseInt(n, 10));
        if (ym[1] == 1) {
            return (ym[0] - 1) + '-' + '12';
        }
        return ym[0] + '-' + pad2(ym[1] - 1);

    }

    function ymToFetch(ym) {
        return fetch('/api/' + ym);
    }

    function show(project, run) {
        alert(project + '-' + run);
    }

    function hide() {
    }

    var app = new Vue({
        el: '#app',
        data: {
            index: [
                {
                    month: "2015-09",
                    integrations: [
                        // { date: '2015-09-20T18:38:51Z', project: 'nwq', run: 1, result: 0,   id: 'a72b9cde9aba1fdf83fc800b3e260bb6e3bb7173' },
                    ]
                }
            ]
        },
        methods: { show: show, hide: hide }
    });

    var integrationCount = 0;
    var monthCount = 0;


    function requestNext(now) {
        if (monthCount < 24 && integrationCount < 24) {
            var previous = getPrevious(now);
            monthCount++;
            ymToFetch(previous).then(handleFetch.bind(null, previous));
        }
    }

    function handleFetch(now, resp) {
        if (resp.status == 404) { return requestNext(now); }
        if (!resp.ok) { alert("Error requesting data"); }
        resp.json().then((j) => {
            integrationCount = integrationCount + j.integrations.length;
            app.$data.index.push(j);
            requestNext(now);
        }).catch((e) => {
            alert(e.message);
        })
    }

    ymToFetch(getNow()).then(handleFetch.bind(null, getNow()));


}
