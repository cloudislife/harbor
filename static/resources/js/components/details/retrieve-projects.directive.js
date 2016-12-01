/*
    Copyright (c) 2016 VMware, Inc. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
        
        http://www.apache.org/licenses/LICENSE-2.0
        
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
(function() {
  
  'use strict';
  
  angular
    .module('harbor.details')
    .directive('retrieveProjects', retrieveProjects);
  
  RetrieveProjectsController.$inject = ['$scope', 'nameFilter', '$filter', 'trFilter', 'ListProjectService', '$location', 'getParameterByName', 'CurrentProjectMemberService', '$window'];
   
  function RetrieveProjectsController($scope, nameFilter, $filter, trFilter, ListProjectService, $location, getParameterByName, CurrentProjectMemberService, $window) {
    var vm = this;
    
    vm.projectName = '';
    vm.isOpen = false;
    
    if(getParameterByName('is_public', $location.absUrl())) {
      vm.isPublic = getParameterByName('is_public', $location.absUrl()) === 'true' ? 1 : 0;
      vm.publicity = (vm.isPublic === 1) ? true : false;
    }

    vm.retrieve = retrieve;
    vm.filterInput = '';
    vm.selectItem = selectItem;  
    vm.checkProjectMember = checkProjectMember;  
       
    $scope.$watch('vm.selectedProject', function(current, origin) {
      if(current) {        
        vm.selectedId = current.project_id;
      }
    });
       
    $scope.$watch('vm.publicity', function(current, origin) { 
      vm.publicity = current ? true : false;
      vm.isPublic =  vm.publicity ? 1 : 0;
      vm.projectType = (vm.isPublic === 1) ? 'public_projects' : 'my_projects';
      vm.retrieve();      
    });
       
    function retrieve() {
      ListProjectService(vm.projectName, vm.isPublic)
        .success(getProjectSuccess)
        .error(getProjectFailed);
    }
    
    function getProjectSuccess(data, status) {
      vm.projects = data;

      if(vm.projects == null) {
        vm.isPublic = 1;
        vm.publicity = true;
        vm.projectType = 'public_projects';
        console.log('vm.projects is null, load public projects.');
        return;
      }
      
      if(angular.isArray(vm.projects) && vm.projects.length > 0) {
        vm.selectedProject = vm.projects[0];    
      }else{
        $window.location.href = '/project';        
      }
      
      if(getParameterByName('project_id', $location.absUrl())){
        angular.forEach(vm.projects, function(value, index) {
          if(value['project_id'] === Number(getParameterByName('project_id', $location.absUrl()))) {
            vm.selectedProject = value;
          }
        }); 
      }
     
      $location.search('project_id', vm.selectedProject.project_id);
      
      vm.checkProjectMember(vm.selectedProject.project_id);      
      vm.resultCount = vm.projects.length;
    
      $scope.$watch('vm.filterInput', function(current, origin) {  
        vm.resultCount = $filter('name')(vm.projects, vm.filterInput, 'name').length;
      });
    }
    
    function getProjectFailed(data) {
      $scope.$emit('modalTitle', $filter('tr')('error'));
      $scope.$emit('modalMessage', $filter('tr')('failed_to_get_project'));
      $scope.$emit('raiseError', true);
      console.log('Failed to list projects.');
    }
      
    function selectItem(item) {
      vm.selectedProject = item;
      $location.search('project_id', vm.selectedProject.project_id);
    }       
  
    $scope.$on('$locationChangeSuccess', function(e) {
      var projectId = getParameterByName('project_id', $location.absUrl());
      vm.isOpen = false;   
    });
    
    function checkProjectMember(projectId) {
      CurrentProjectMemberService(projectId)
        .success(getCurrentProjectMemberSuccess)
        .error(getCurrentProjectMemberFailed);
    }
    
    function getCurrentProjectMemberSuccess(data, status) {
      console.log('Successful get current project member:' + status);
      vm.isProjectMember = true;
    }
    
    function getCurrentProjectMemberFailed(data, status) {
      vm.isProjectMember = false;           
      console.log('Current user has no member for the project:' + status +  ', location.url:' + $location.url());
    }
    
  }
  
  function retrieveProjects() {
    var directive = {
      restrict: 'E',
      templateUrl: '/static/resources/js/components/details/retrieve-projects.directive.html',
      scope: {
        'isOpen': '=',
        'selectedProject': '=',
        'publicity': '=',
        'isProjectMember': '='
      },
      link: link,
      controller: RetrieveProjectsController,
      bindToController: true,
      controllerAs: 'vm'
    };
    
    return directive;
    
    function link(scope, element, attrs, ctrl) {
      $(document).on('click', clickHandler);
    
      function clickHandler(e) {
        $('[data-toggle="popover"]').each(function () {          
          if (!$(this).is(e.target) && 
               $(this).has(e.target).length === 0 &&
               $('.popover').has(e.target).length === 0) {
             $(this).parent().popover('hide');
          }
        });
        var targetId = $(e.target).attr('id');
        if(targetId === 'switchPane' || 
           targetId === 'retrievePane' ||
           targetId === 'retrieveFilter') {
          return;            
        }else{
          ctrl.isOpen = false;
          scope.$apply();
        }
      }
    }

  }
  
})();