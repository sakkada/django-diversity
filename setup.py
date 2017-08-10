#!/usr/bin/env python
# - coding: utf-8 -
from distutils.core import setup

for cmd in ('egg_info', 'develop'):
    import sys
    if cmd in sys.argv:
        from setuptools import setup

import sys
reload(sys).setdefaultencoding("UTF-8")

setup(
    name='django-diversity',
    version='0.1',

    description = (u'Set of extensions for "django-diverse".'.encode('utf8')),
    long_description = (open('README.rst').read().decode('utf8')
                        + open('CHANGES.rst').read().decode('utf8')),

    author='Guchetl Murat',
    author_email='gmurka@gmail.com',

    url='https://bitbucket.org/sakkada/django-diversity/',

    packages=['diversity',],
    license = 'MIT license',

    requires=['django (>= 1.8.0)'],

    classifiers=(
        'Development Status :: 4 - Beta',
        'Environment :: Web Environment',
        'Framework :: Django',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Natural Language :: Russian',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.6',
        'Programming Language :: Python :: 2.7',
        'Topic :: Software Development :: Libraries :: Python Modules',
    ),
)
