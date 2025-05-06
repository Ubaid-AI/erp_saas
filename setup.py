# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

with open('requirements.txt') as f:
	install_requires = f.read().strip().split('\n')

# get version from __version__ variable in erp_saas/__init__.py
from erp_saas import __version__ as version

setup(
	name='erp_saas',
	version=version,
	description='App to manage ERPNext User and Space limitations',
	author='Havenir Solutions Private Limited',
	author_email='info@havenir.com',
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
