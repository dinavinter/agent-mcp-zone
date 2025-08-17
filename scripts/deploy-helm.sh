#!/bin/bash

./build-and-push.sh
helm upgrade aspire-ai ./host/aspirate-output/Chart/ -n aspire-ai --install --create-namespace
kubectl get pods -n aspire-ai

