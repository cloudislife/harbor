(function() {

    angular
        .module('harbor.project.build', [])
        .directive('onlineBuild', onlineBuild)
        .service('BuildService', onlineBuildService)
        .factory('$httpStream', httpStream);


    onlineBuildController.$inject = ['$scope', '$filter', 'trFilter', '$location', 'getParameterByName', '$timeout', '$interval', 'BuildService'];

    function onlineBuildController($scope, $filter, trFilter, $location, getParameterByName, $timeout, $interval, BuildService) {

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

        vm.upbuild = upbuild;

        vm.projectId = getParameterByName('project_id', $location.absUrl());

        $scope.$on('$locationChangeSuccess', function() {
            vm.projectId = getParameterByName('project_id', $location.absUrl());
        });

        $scope.fileContextStatus = '请上传镜像文件！';
        $scope.file = null;

        var upload_btn, file, $stdout;

        var stack = [], loopID, last, $lastln;
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
                                content = '<span style="color: blue;">status :: </span>' + shift['status'] + ' &gt;&gt;&gt; ' +
                                    (shift['progress'] ? (' detail : ' + (progressDetail['current'] + ' / ' + progressDetail['total']) + '<br>' + shift['progress']) : 'Done!');
                            } else {
                                var aux = shift['aux'];
                                content = '<span style="color: blue;">aux :: </span> <br>' + (aux ? ['Tag: ' + aux['Tag'], 'Digest: ' + aux['Digest'], 'Size: ' + aux['']].join('<br>') : '');
                            }

                        } else if (typeof shift == 'string') {
                            content = '<span style="color: blue;">'+shift+'</span> <br>';
                            if(/build success\!$/.test(shift)){
                              $timeout(function() {
                                  $scope.isUpBuilding = false;
                              }, 800);
                            }
                        } else {
                            content = '' + shift;
                        }

                        context = $('<p>' + content + '</p>');

                        $timeout(function() {
                            if (last != flag) {
                                $context = $(context);
                                $stdout.append($context);
                                $lastout = $context;
                                last = flag;
                            } else {
                                $lastout.html(context);
                            }
                            $timeout(function(){
                              $stdout.parent().scrollTop($stdout[0].scrollHeight);
                            });
                        });
                    }
                }, 150);
            }
        }

        function upbuild() {
            if (!upload_btn) {
                upload_btn = $scope.uploadBtn;
                $stdout = $scope.stdout;
                upload_btn.change(function(evt) {
                    file = evt.target.files[0];
                    if (file && file.name) {

                        $scope.file = file;
                        $scope.fileContextStatus = file.name;
                        $scope.isUpBuilding = true;
                        $stdout.empty();

                        stack = [];
            						last = null;
            						$lastln;

                        $timeout(function() {
                            BuildService.upBuildStream($scope.imageName, file, vm.projectId, function(response) {
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

                            }, function(exception) {
                                $scope.isUpBuilding = false;
                                $timeout(function() {
                                    $stdout.append('操作失败！(服务或服务器异常)');
                                });
                            });
                        });

                    } else {
                        $scope.fileContextStatus = '请上传镜像文件！';
                        $scope.file = null;
                    }

                });
            }
            $timeout(function() {
                upload_btn.trigger('click');
            });
        }

    }

    function onlineBuild() {
        return {
            'restrict': 'E',
            'templateUrl': '/static/resources/extensions/online-build.directive.html',
            'scope ': {
                'sectionHeight': '='
            },
            link: function(scope, element, attrs, ctrl) {
                scope.uploadBtn = element.find('#upload-image-btn');
                scope.stdout = element.find('#stdout');
            },
            'controller': onlineBuildController,
            'controllerAs': 'vm',
            'bindToController': true
        }
    }

    // service
    onlineBuildService.$inject = ['$q', '$http', '$timeout', '$httpStream'];

    function onlineBuildService($q, $http, $timeout, $httpStream) {

        this.upBuildStream = function(name, file, projectId, callback) {
            var api_upbuild = '/api/images/push?repoName=' + name + '&project_id=' + projectId;
            var form = new FormData();
            form.append('file', file);
            return $httpStream({
                method: 'POST',
                url: api_upbuild
            }, form, callback);
        };

    }

    // $httpStream
    function httpStream() {
        return function ajax_stream(opts, data, cb, er) {

            if (!window.XMLHttpRequest) {
                return undefined;
            }

            try {
                var xhr = new XMLHttpRequest();
                xhr.previous_text = '';
                xhr.onreadystatechange = function() {
                    try {
                        if (xhr.readyState > 2) {
                            var new_response = xhr.responseText.substring(xhr.previous_text.length);
                            xhr.previous_text = xhr.responseText;
                            cb.call(null, new_response);
                        }
                    } catch (e) {
                        if (er) er.call(null, e);
                    }
                };

                var method = opts.method || 'GET';
                var isAsync = opts.async || true;
                var headers = opts.headers || {};

                xhr.open(method, opts.url, isAsync);

                for (var key in headers) {
                    xhr.setRequestHeader(key, headers[key]);
                }

                xhr.send(data);
            } catch (e) {
                console.log("[XHR] Exception: " + e);
                if (er) er.call(null, e);
            }

        }
    }

})();
