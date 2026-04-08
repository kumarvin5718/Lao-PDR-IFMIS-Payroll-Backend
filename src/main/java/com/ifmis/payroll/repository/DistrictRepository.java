package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.District;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DistrictRepository extends JpaRepository<District, String> {
    Optional<District> findByName(String name);
}
