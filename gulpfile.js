// Gulpfile.js
var gulp = require('gulp'),
  gutil = require('gulp-util'),
  clean = require('gulp-clean')

var dest_folder_build = 'buildSite'

gulp.task('clean-build', function () {
  return gulp.src(dest_folder_build, { read: false })
  .pipe(clean())
})

gulp.task('buildsite', ['clean-build'], function () {
  gulp.src(['build/**/*.*'], { base: '.' }) // TODO remove solidy contracts dependency
  .pipe(gulp.dest(dest_folder_build))

  // Copy folders
  gulp.src([
    'clients/**/*.*', 
    'repositories/**/*.*', 
    'utils/**/*.*',
    'app.js', 
    'npm-shrinkwrap.json',
    'package.json'
  ], { base: '.' })
  .on('error', function (err) { gutil.log(gutil.colors.red('[Error]'), err.toString()) })
  .pipe(gulp.dest(dest_folder_build))

  // Copy files
  gulp.src([], { base: '.' })
  .on('error', function (err) { gutil.log(gutil.colors.red('[Error]'), err.toString()) })
  .pipe(gulp.dest(dest_folder_build))
})

gulp.task('default', function () {
  return gutil.log('Gulp is running!')
})
