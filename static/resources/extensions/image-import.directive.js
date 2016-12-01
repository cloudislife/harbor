(function() {

    angular
        .module('harbor.project.import', [])
        .directive('imageImport', imageImport);

    imageImportController.$inject = ['$scope', '$filter', 'trFilter', '$location', 'getParameterByName', '$timeout', '$interval', '$httpStream'];

    function imageImportController($scope, $filter, trFilter, $location, getParameterByName, $timeout, $interval, $httpStream) {

        $scope.subsTabPane = 30;

        var vm = this;

        vm.sectionHeight = {
            'min-height': '579px'
        };

        var hashValue = $location.hash();
        if (hashValue) {
            var slashIndex = hashValue.indexOf('/');
            if (slashIndex >= 0) {
                vm.filterInput = hashValue.substring(slashIndex + 1);
            } else {
                vm.filterInput = hashValue;
            }
        }

        vm.imoprt = imoprt;

        vm.projectId = getParameterByName('project_id', $location.absUrl());

        $scope.$on('$locationChangeSuccess', function() {
            vm.projectId = getParameterByName('project_id', $location.absUrl());
        });

        var stack = [], idsMap = {},
            loopID, last, $lastln;

        function stdoutLoop() {
            if (!loopID) {
                loopID = $interval(function() {
                    if (!stack.length && loopID) {
                        $interval.cancel(loopID);
												loopID = false;
                    } else {
                        var shift = stack.shift();
                        var flag = shift['stream'] ? 'stream' : (shift['status'] ? shift['status'] : shift);
                        var content;

                        if (shift.toString() == '[object Object]') {

                            if (shift['stream']) {
                                content = '<span style="color: blue;">stream :: </span>' + shift['stream'];
                            } else if (shift['status']) {
                                var progressDetail = shift['progressDetail'];
                                content = '<span style="color: blue;">status :: </span>' + shift['status'] + ' &gt;&gt;&gt; <span style="color: blue;">id :: </span> ' + shift['id'] +
                                    (shift['progress'] ? ('&gt;&gt;&gt; detail : ' + (progressDetail['current'] + ' / ' + progressDetail['total']) + '<br>' + shift['progress']) : '');
                            } else {
                                var aux = shift['aux'];
                                content = '<span style="color: blue;">aux :: </span> <br>' + (aux ? ['Tag: ' + aux['Tag'], 'Digest: ' + aux['Digest'], 'Size: ' + aux['']].join('<br>') : '');
                            }

                        } else if (typeof shift == 'string') {
                            content = '<span style="color: blue;">'+shift+'</span> <br>';
                            if (/build success\!$/.test(shift)) {
                                $timeout(function() {
                                    $scope.imoprtFlag = false;
                                }, 800);
                            }
                        } else {
                            content = '' + shift;
                        }

                        context = $('<p>' + content + '</p>');

                        $timeout(function() {
                            if (last != flag && !shift.id && !shift.progressDetail) {
                                $context = $(context);
                                $stdout.append($context);
                                $lastout = $context;
                                last = flag;
                            } else {
																if(!shift.id){
																	$lastln.html(context);
																} else {
																	var id = shift['id'], $idout = idsMap[id];
																	if(!$idout){
																		idsMap[id] = $(context);
																		$idout = idsMap[id];
																		$stdout.append($idout);
																	} else {
																		$idout.html(context);
																	}
																}
                            }
                            $timeout(function() {
                                $stdout.parent().scrollTop($stdout[0].scrollHeight);
                            });
                        });
                    }
                }, 150);
            }
        }

        // daocloud.io/library/postgres:9.4-beta2
        // daocloud.io/library/nginx:stable

        var $stdout;

        function imoprt() {
            $scope.imoprtFlag = true;

						stack = [];
						idsMap = {};
						last = null;
						$lastln;

            if (!$stdout) $stdout = $scope.stdout;
            $stdout.empty();

            var api_import = "/api/images/pull?fromImage=" + $scope.imageSrc.trim() + "&project_id=" + vm.projectId;

            $httpStream({
                method: 'POST',
                url: api_import
            }, null, function(response) {

                console.log(response);

                if (!response) return;

                var isEnd = false;
                if (/build success\!$/.test(response)) {
                    console.info('== END ==');
                    isEnd = true;
                    response = response.replace(/build success!$/, "\"build success!\"");
                }

                response = response.trim().replace(/[\n]/g, ',');
                response = '[' + response + ']';
                try {
                    response = JSON.parse(response);
                } catch (ex) {
                    console.log(ex, '\n', response);
                }

                stack = stack.concat(response);

                stdoutLoop();
            }, function(err) {
                $scope.imoprtFlag = false;
                $timeout(function() {
                    $stdout.append(err);
                });
            });
        }

    }

    function imageImport() {
        return {
            'restrict': 'E',
            'templateUrl': '/static/resources/extensions/image-import.directive.html',
            'scope ': {
                'sectionHeight': '='
            },
            link: function(scope, element) {
                scope.stdout = element.find('#stdout');
            },
            'controller': imageImportController,
            'controllerAs': 'vm',
            'bindToController': true
        }
    }

})();
