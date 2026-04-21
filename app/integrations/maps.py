def generate_map_link(task_location, volunteer_location):
    """
    Generate Google Maps direction link between volunteer and task
    """

    try:
        t_lat = task_location["lat"]
        t_lon = task_location["lon"]

        v_lat = volunteer_location["lat"]
        v_lon = volunteer_location["lon"]

        return f"https://www.google.com/maps/dir/{v_lat},{v_lon}/{t_lat},{t_lon}"

    except Exception:
        return None
