module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: ['build', 'dist'],
    concat: {
      js: {
        src: ['haven_artifacts/main/**/*.js', 'src/*.js'],
        dest: 'dist/analytics-client.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-haven');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');

  // Tasks

  grunt.registerTask('build', ['clean', 'concat']);
  grunt.registerTask('dist', ['haven:update', 'build']);

  grunt.registerTask('deploy', ['haven:deploy']);
  grunt.registerTask('ci', ['haven:deployOnly']);

  // Default task(s).
  grunt.registerTask('default', ['deploy']);

};