# Simple CI

## How simple, in code, config and setup is it possible for a CI system to be?

I've used a good few CI systems and enjoy working as a developer in that way but recently I started looking at how to install and run one...

They all seemed overly complex to run, particularly so if you want to run them in a container. This got me thinking... It seems that no matter what the language there are always lots of BASH holding together the CI pipeline, what if we could write the whole CI system in BASH?

Is this crazy? Perhaps, but at the end of the day if CI systems spend most of the time running bash scripts there may be significant advantages to using this approach to develop the system itself.

This project is an exploration of that.

What is working:

 * Script for checkout
 * Script for running a pipeline and reporting errors in that pipeline
 * Script for an API method for getting results / debugging that pipeline.

What is still required

 * Find a recommended web server that can be used for CGI operations.
 * Add webpages / server config for displaying results.
 * Think more about containerization and the implications of that.
 * Find a way to run the pipeline script and webserver together within docker.

If required get a [security token from GitHub](https://github.com/settings/tokens) and store in `$SIMPLECI_AUTH`

Constants


Configuration


